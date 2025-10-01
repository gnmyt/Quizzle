use flate2::write::ZlibEncoder;
use flate2::Compression;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

use crate::formats::Quizzle2Quiz;

pub fn find_quiz_files<P: AsRef<Path>>(root_dir: P) -> Result<Vec<PathBuf>, Box<dyn std::error::Error>> {
    let mut quiz_files = Vec::new();

    for entry in WalkDir::new(root_dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            if let Some(extension) = path.extension().and_then(|ext| ext.to_str()) {
                if extension == "quizlet" || extension == "quizzle" {
                    quiz_files.push(path.to_path_buf());
                }
            }
        }
    }

    Ok(quiz_files)
}

pub fn backup_file<P: AsRef<Path>>(original_path: P) -> Result<(), Box<dyn std::error::Error>> {
    let original_path = original_path.as_ref();
    let backup_path = original_path.with_extension(format!("{}.bak", 
        original_path.extension().and_then(|ext| ext.to_str()).unwrap_or("file")));
    
    fs::copy(original_path, &backup_path)?;
    println!("  Backup created: {}", backup_path.display());
    
    Ok(())
}

pub fn save_quizzle2_file<P: AsRef<Path>>(quiz: &Quizzle2Quiz, output_path: P) -> Result<(), Box<dyn std::error::Error>> {
    let output_path = output_path.as_ref();
    let json_content = serde_json::to_string_pretty(quiz)?;

    let mut compressed_data = Vec::new();
    {
        let mut encoder = ZlibEncoder::new(&mut compressed_data, Compression::default());
        encoder.write_all(json_content.as_bytes())?;
        encoder.finish()?;
    }

    fs::write(output_path, compressed_data)?;
    Ok(())
}
