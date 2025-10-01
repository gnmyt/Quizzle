use base64::prelude::*;
use flate2::read::ZlibDecoder;
use std::fs;
use std::io::Read;
use std::path::Path;

use crate::formats::{BfsitQuiz, Quizzle1Quiz, Quizzle2Quiz};

#[derive(Debug)]
pub enum QuizFormat {
    Bfsit(BfsitQuiz),
    Quizzle1(Quizzle1Quiz),
    Quizzle2(Quizzle2Quiz),
}

pub fn decode_quiz_file<P: AsRef<Path>>(path: P) -> Result<QuizFormat, Box<dyn std::error::Error>> {
    let path = path.as_ref();
    let content = fs::read(path)?;
    
    let extension = path.extension().and_then(|ext| ext.to_str()).unwrap_or("");
    
    match extension {
        "quizlet" => decode_quizlet_file(&content),
        "quizzle" => decode_quizzle_file(&content),
        _ => Err(format!("Unsupported file extension: {}", extension).into()),
    }
}

fn decode_quizlet_file(content: &[u8]) -> Result<QuizFormat, Box<dyn std::error::Error>> {
    let content_str = String::from_utf8(content.to_vec())?;
    let decoded_bytes = BASE64_STANDARD.decode(content_str.trim())?;
    let decoded_str = String::from_utf8(decoded_bytes)?;
    
    parse_quiz_json(&decoded_str)
}

fn decode_quizzle_file(content: &[u8]) -> Result<QuizFormat, Box<dyn std::error::Error>> {
    let mut decoder = ZlibDecoder::new(content);
    let mut decompressed = Vec::new();
    decoder.read_to_end(&mut decompressed)?;
    
    let decompressed_str = String::from_utf8(decompressed)?;
    parse_quiz_json(&decompressed_str)
}

fn parse_quiz_json(content: &str) -> Result<QuizFormat, Box<dyn std::error::Error>> {
    if let Ok(quiz) = serde_json::from_str::<Quizzle2Quiz>(content) {
        return Ok(QuizFormat::Quizzle2(quiz));
    }

    if let Ok(quiz) = serde_json::from_str::<Quizzle1Quiz>(content) {
        return Ok(QuizFormat::Quizzle1(quiz));
    }

    if let Ok(quiz) = serde_json::from_str::<BfsitQuiz>(content) {
        return Ok(QuizFormat::Bfsit(quiz));
    }
    
    Err("Could not parse as any known quiz format".into())
}
