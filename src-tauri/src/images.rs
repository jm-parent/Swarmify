use std::collections::hash_map::RandomState;
use std::collections::HashSet;
use std::fs;
use std::hash::{BuildHasher, Hasher};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use base64::prelude::BASE64_STANDARD;
use base64::Engine as _;
use serde::Serialize;
use tauri::{AppHandle, Manager};

pub const MAX_IMAGE_BYTES: u64 = 20 * 1024 * 1024;
const TOO_LARGE_ERROR: &str = "Image trop lourde : 20 Mo maximum";
const COPY_ERROR: &str = "Copie impossible : espace disque ou dossier inaccessible";
const UTF8_BOM: &[u8] = &[0xEF, 0xBB, 0xBF];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImageFormat {
    Png,
    Jpeg,
    Gif,
    Webp,
    Svg,
}

impl ImageFormat {
    fn name(self) -> &'static str {
        match self {
            ImageFormat::Png => "png",
            ImageFormat::Jpeg => "jpeg",
            ImageFormat::Gif => "gif",
            ImageFormat::Webp => "webp",
            ImageFormat::Svg => "svg",
        }
    }

    // The file name regex only admits `jpg` for JPEG, so `.jpeg` is stored as `.jpg`.
    fn extension(self) -> &'static str {
        match self {
            ImageFormat::Jpeg => "jpg",
            other => other.name(),
        }
    }
}

#[derive(Serialize)]
pub struct ImageImport {
    pub file: String,
    pub path: String,
    pub format: &'static str,
    pub bytes: u64,
}

fn format_from_extension(ext: &str) -> Result<ImageFormat, String> {
    match ext.to_ascii_lowercase().as_str() {
        "png" => Ok(ImageFormat::Png),
        "jpg" | "jpeg" => Ok(ImageFormat::Jpeg),
        "gif" => Ok(ImageFormat::Gif),
        "webp" => Ok(ImageFormat::Webp),
        "svg" => Ok(ImageFormat::Svg),
        _ => Err(format!("Format non supporté : .{ext}")),
    }
}

pub fn validate_file_name(name: &str) -> Result<(), String> {
    let valid = name.split_once('.').is_some_and(|(stem, ext)| {
        stem.len() == 36
            && stem.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b) || b == b'-')
            && matches!(ext, "png" | "jpg" | "gif" | "webp" | "svg")
    });
    if valid {
        Ok(())
    } else {
        Err(format!("Nom de fichier invalide : {name}"))
    }
}

pub fn check_size(len: u64) -> Result<(), String> {
    if len > MAX_IMAGE_BYTES {
        Err(TOO_LARGE_ERROR.to_string())
    } else {
        Ok(())
    }
}

pub fn detect_format(bytes: &[u8]) -> Option<ImageFormat> {
    if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        Some(ImageFormat::Png)
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some(ImageFormat::Jpeg)
    } else if bytes.starts_with(b"GIF8") {
        Some(ImageFormat::Gif)
    } else if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" {
        Some(ImageFormat::Webp)
    } else if is_svg(bytes) {
        Some(ImageFormat::Svg)
    } else {
        None
    }
}

// Skips the BOM, whitespace, XML declaration, comments and DOCTYPE, then expects the root `<svg`.
fn is_svg(bytes: &[u8]) -> bool {
    let mut rest = bytes.strip_prefix(UTF8_BOM).unwrap_or(bytes);
    loop {
        rest = rest.trim_ascii_start();
        let end: &[u8] = if rest.starts_with(b"<?") {
            b"?>"
        } else if rest.starts_with(b"<!--") {
            b"-->"
        } else if rest.starts_with(b"<!") {
            b">"
        } else {
            break;
        };
        match find(rest, end) {
            Some(i) => rest = &rest[i + end.len()..],
            None => return false,
        }
    }
    rest.starts_with(b"<svg")
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|w| w == needle)
}

// Checks the extension, the size and that the magic bytes match the extension.
pub fn check_import(ext: &str, bytes: &[u8]) -> Result<ImageFormat, String> {
    let format = format_from_extension(ext)?;
    check_size(bytes.len() as u64)?;
    if detect_format(bytes) != Some(format) {
        return Err(format!("Format non supporté : contenu incompatible avec .{ext}"));
    }
    Ok(format)
}

// Not an RFC 4122 UUID: 128 bits from SipHash keyed by OS randomness, time and a counter.
pub fn new_file_stem() -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let count = COUNTER.fetch_add(1, Ordering::Relaxed);

    let mut hi = RandomState::new().build_hasher();
    hi.write_u128(nanos);
    hi.write_u64(count);
    hi.write_u32(std::process::id());
    let mut lo = RandomState::new().build_hasher();
    lo.write_u64(count);
    lo.write_u128(nanos);
    let value = ((hi.finish() as u128) << 64) | lo.finish() as u128;

    let hex = format!("{value:032x}");
    format!("{}-{}-{}-{}-{}", &hex[0..8], &hex[8..12], &hex[12..16], &hex[16..20], &hex[20..32])
}

fn store_image(dir: &Path, format: ImageFormat, bytes: &[u8]) -> Result<ImageImport, String> {
    let file = format!("{}.{}", new_file_stem(), format.extension());
    let path = dir.join(&file);
    if fs::write(&path, bytes).is_err() {
        let _ = fs::remove_file(&path);
        return Err(COPY_ERROR.to_string());
    }
    Ok(ImageImport {
        file,
        path: path.to_string_lossy().into_owned(),
        format: format.name(),
        bytes: bytes.len() as u64,
    })
}

fn ensure_dir(app_data: &Path) -> Result<PathBuf, String> {
    let dir = app_data.join("images");
    fs::create_dir_all(&dir).map_err(|e| format!("Dossier images inaccessible : {e}"))?;
    Ok(dir)
}

fn app_images_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app.path().app_data_dir().map_err(|e| e.to_string())?;
    ensure_dir(&root)
}

// Deletes files of `dir` whose name is valid and absent from `referenced`; returns how many were removed.
pub fn purge_unused(dir: &Path, referenced: &[String]) -> Result<u32, String> {
    let keep: HashSet<&str> = referenced.iter().map(String::as_str).collect();
    let mut removed = 0;
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name();
        let Some(name) = name.to_str() else { continue };
        if validate_file_name(name).is_err() || keep.contains(name) {
            continue;
        }
        if entry.file_type().is_ok_and(|t| t.is_file()) && fs::remove_file(entry.path()).is_ok() {
            removed += 1;
        }
    }
    Ok(removed)
}

#[tauri::command]
pub fn images_dir(app: AppHandle) -> Result<PathBuf, String> {
    app_images_dir(&app)
}

#[tauri::command]
pub fn import_image(app: AppHandle, source_path: PathBuf) -> Result<ImageImport, String> {
    let dir = app_images_dir(&app)?;
    let ext = source_path.extension().and_then(|e| e.to_str()).unwrap_or("");
    format_from_extension(ext)?;
    let read_error = |e: std::io::Error| format!("Lecture impossible : {e}");
    check_size(fs::metadata(&source_path).map_err(read_error)?.len())?;
    let bytes = fs::read(&source_path).map_err(read_error)?;
    let format = check_import(ext, &bytes)?;
    store_image(&dir, format, &bytes)
}

#[tauri::command]
pub fn save_image_bytes(app: AppHandle, format: String, data_base64: String) -> Result<ImageImport, String> {
    let dir = app_images_dir(&app)?;
    format_from_extension(&format)?;
    let bytes = BASE64_STANDARD
        .decode(data_base64)
        .map_err(|e| format!("Image invalide : {e}"))?;
    let kind = check_import(&format, &bytes)?;
    store_image(&dir, kind, &bytes)
}

#[tauri::command]
pub fn save_sanitized_svg(app: AppHandle, file: String, contents: String) -> Result<(), String> {
    validate_file_name(&file)?;
    if !file.ends_with(".svg") {
        return Err(format!("Fichier SVG attendu : {file}"));
    }
    let path = app_images_dir(&app)?.join(&file);
    if !path.is_file() {
        return Err(format!("Image introuvable : {file}"));
    }
    fs::write(path, contents).map_err(|e| format!("Écriture impossible : {e}"))
}

#[tauri::command]
pub fn copy_image_file(app: AppHandle, file: String, dest_path: PathBuf) -> Result<(), String> {
    validate_file_name(&file)?;
    let src = app_images_dir(&app)?.join(&file);
    if let Some(parent) = dest_path.parent() {
        fs::create_dir_all(parent).map_err(|_| COPY_ERROR.to_string())?;
    }
    fs::copy(src, dest_path).map(|_| ()).map_err(|_| COPY_ERROR.to_string())
}

#[tauri::command]
pub fn purge_unused_images(app: AppHandle, referenced: Vec<String>) -> Result<u32, String> {
    let dir = app_images_dir(&app)?;
    purge_unused(&dir, &referenced)
}

#[cfg(test)]
mod tests {
    use super::*;

    const PNG: &[u8] = &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
    const JPEG: &[u8] = &[0xFF, 0xD8, 0xFF, 0xE0];
    const BMP: &[u8] = b"BM\x00\x00";
    const VALID_STEM: &str = "01234567-89ab-cdef-0123-456789abcdef";

    struct TempDir(PathBuf);

    impl TempDir {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir().join(format!("swarmify-images-{}-{name}", std::process::id()));
            let _ = fs::remove_dir_all(&dir);
            fs::create_dir_all(&dir).unwrap();
            TempDir(dir)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn images_detecte_les_formats_par_octets_magiques() {
        assert_eq!(detect_format(PNG), Some(ImageFormat::Png));
        assert_eq!(detect_format(JPEG), Some(ImageFormat::Jpeg));
        assert_eq!(detect_format(b"GIF89a...."), Some(ImageFormat::Gif));
        assert_eq!(detect_format(b"RIFF\x24\x00\x00\x00WEBPVP8 "), Some(ImageFormat::Webp));
        assert_eq!(detect_format(b"<svg xmlns=\"http://www.w3.org/2000/svg\"/>"), Some(ImageFormat::Svg));
        assert_eq!(
            detect_format("\u{feff}<?xml version=\"1.0\"?>\n<!-- c -->\n<svg/>".as_bytes()),
            Some(ImageFormat::Svg)
        );
        assert_eq!(detect_format(BMP), None);
        assert_eq!(detect_format(b"RIFF\x00\x00\x00\x00AVI "), None);
    }

    #[test]
    fn images_rejette_un_bmp() {
        assert_eq!(check_import("bmp", BMP), Err("Format non supporté : .bmp".to_string()));
    }

    #[test]
    fn images_rejette_un_png_aux_octets_jpeg() {
        assert!(check_import("png", JPEG).is_err());
        assert_eq!(check_import("jpg", JPEG), Ok(ImageFormat::Jpeg));
    }

    #[test]
    fn images_rejette_une_image_trop_lourde() {
        assert!(check_size(MAX_IMAGE_BYTES).is_ok());
        assert_eq!(
            check_size(MAX_IMAGE_BYTES + 1),
            Err("Image trop lourde : 20 Mo maximum".to_string())
        );
    }

    #[test]
    fn images_valide_les_noms_de_fichier() {
        assert!(validate_file_name(&format!("{VALID_STEM}.png")).is_ok());
        assert!(validate_file_name(&format!("{VALID_STEM}.jpg")).is_ok());
        assert!(validate_file_name(&format!("{VALID_STEM}.svg")).is_ok());
        for bad in [
            format!("../{VALID_STEM}.png"),
            format!("a\\{VALID_STEM}.png"),
            format!("{}.png", VALID_STEM.to_uppercase()),
            format!("{VALID_STEM}.bmp"),
            format!("{VALID_STEM}.jpeg"),
            format!("{VALID_STEM}.png.exe"),
            format!("{}.png", &VALID_STEM[1..]),
        ] {
            assert!(validate_file_name(&bad).is_err(), "{bad} devrait être refusé");
        }
    }

    #[test]
    fn images_genere_des_noms_valides_et_uniques() {
        let stems: HashSet<String> = (0..200).map(|_| new_file_stem()).collect();
        assert_eq!(stems.len(), 200);
        for stem in &stems {
            assert!(validate_file_name(&format!("{stem}.png")).is_ok(), "{stem}");
        }
    }

    #[test]
    fn images_purge_ne_supprime_que_les_fichiers_non_references() {
        let tmp = TempDir::new("purge-refs");
        let kept = format!("{VALID_STEM}.png");
        let orphan_jpg = format!("{}.jpg", new_file_stem());
        let orphan_svg = format!("{}.svg", new_file_stem());
        for name in [&kept, &orphan_jpg, &orphan_svg] {
            fs::write(tmp.0.join(name), b"x").unwrap();
        }

        assert_eq!(purge_unused(&tmp.0, std::slice::from_ref(&kept)), Ok(2));
        assert!(tmp.0.join(&kept).exists());
        assert!(!tmp.0.join(&orphan_jpg).exists());
        assert!(!tmp.0.join(&orphan_svg).exists());
    }

    #[test]
    fn images_purge_ignore_les_noms_invalides() {
        let tmp = TempDir::new("purge-invalid");
        let orphan = format!("{VALID_STEM}.png");
        for name in ["notes.txt", "evil.png", orphan.as_str()] {
            fs::write(tmp.0.join(name), b"x").unwrap();
        }

        assert_eq!(purge_unused(&tmp.0, &[]), Ok(1));
        assert!(tmp.0.join("notes.txt").exists());
        assert!(tmp.0.join("evil.png").exists());
        assert!(!tmp.0.join(&orphan).exists());
    }
}
