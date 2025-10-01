use std::path::PathBuf;
use std::fs;

use crate::decoder::{decode_quiz_file, QuizFormat};
use crate::file_ops::{find_quiz_files, save_quizzle2_file, backup_file};
use crate::formats::Quizzle2Quiz;

pub fn migrate_directory(directory: &PathBuf, skip_backup: bool) -> Result<usize, Box<dyn std::error::Error>> {
    let quiz_files = find_quiz_files(directory)?;
    let mut migrated_count = 0;
    
    for file in quiz_files {
        println!("Processing: {}", file.display());
        
        match migrate_file(&file, skip_backup) {
            Ok(true) => {
                migrated_count += 1;
                println!("  ✓ Migrated");
            }
            Ok(false) => println!("  - Already up to date"),
            Err(e) => println!("  ✗ Error: {}", e),
        }
    }
    
    Ok(migrated_count)
}

fn migrate_file(file_path: &PathBuf, skip_backup: bool) -> Result<bool, Box<dyn std::error::Error>> {
    let quiz_format = decode_quiz_file(file_path)?;
    
    let quizzle2_quiz = match quiz_format {
        QuizFormat::Quizzle2(_quiz) => return Ok(false),
        QuizFormat::Bfsit(bfsit) => convert_bfsit_to_quizzle2(bfsit),
        QuizFormat::Quizzle1(q1) => convert_quizzle1_to_quizzle2(q1),
    };

    if !skip_backup {
        backup_file(file_path)?;
    }

    let mut output_path = file_path.clone();
    output_path.set_extension("quizzle");
    
    save_quizzle2_file(&quizzle2_quiz, &output_path)?;

    if file_path != &output_path {
        fs::remove_file(file_path)?;
    }
    
    Ok(true)
}

fn convert_bfsit_to_quizzle2(bfsit: crate::formats::BfsitQuiz) -> Quizzle2Quiz {
    Quizzle2Quiz {
        quiz_type: "QUIZZLE2".to_string(),
        title: bfsit.info.title,
        questions: bfsit.questions.into_iter().map(|q| {
            crate::formats::Quizzle2Question {
                title: q.title,
                question_type: "multiple-choice".to_string(),
                answers: q.answers.into_iter().enumerate().map(|(i, content)| {
                    crate::formats::Quizzle2Answer {
                        content,
                        answer_type: Some("text".to_string()),
                        is_correct: Some(i + 1 == q.correct_answer),
                    }
                }).collect(),
                b64_image: None,
            }
        }).collect(),
    }
}

fn convert_quizzle1_to_quizzle2(q1: crate::formats::Quizzle1Quiz) -> Quizzle2Quiz {
    Quizzle2Quiz {
        quiz_type: "QUIZZLE2".to_string(),
        title: q1.title,
        questions: q1.questions.into_iter().map(|q| {
            let answers: Vec<crate::formats::Quizzle2Answer> = q.answers.into_iter().map(|a| {
                crate::formats::Quizzle2Answer {
                    content: a.content,
                    answer_type: Some(a.answer_type),
                    is_correct: Some(a.is_correct),
                }
            }).collect();
            
            let question_type = if answers.len() == 2 { "true-false" } else { "multiple-choice" };
            
            crate::formats::Quizzle2Question {
                title: q.title,
                question_type: question_type.to_string(),
                answers,
                b64_image: q.b64_image,
            }
        }).collect(),
    }
}
