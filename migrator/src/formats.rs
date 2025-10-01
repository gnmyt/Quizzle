use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct BfsitQuiz {
    pub info: BfsitInfo,
    pub questions: Vec<BfsitQuestion>,
}

#[derive(Debug, Deserialize)]
pub struct BfsitInfo {
    pub title: String,
}

#[derive(Debug, Deserialize)]
pub struct BfsitQuestion {
    pub title: String,
    pub answers: Vec<String>,
    #[serde(rename = "correctAnswer")]
    pub correct_answer: usize,
}

#[derive(Debug, Deserialize)]
pub struct Quizzle1Quiz {
    pub title: String,
    pub questions: Vec<Quizzle1Question>,
}

#[derive(Debug, Deserialize)]
pub struct Quizzle1Question {
    pub title: String,
    pub answers: Vec<Quizzle1Answer>,
    pub b64_image: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct Quizzle1Answer {
    pub content: String,
    #[serde(rename = "type")]
    pub answer_type: String,
    pub is_correct: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Quizzle2Quiz {
    #[serde(rename = "__type")]
    pub quiz_type: String,
    pub title: String,
    pub questions: Vec<Quizzle2Question>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Quizzle2Question {
    pub title: String,
    #[serde(rename = "type")]
    pub question_type: String,
    pub answers: Vec<Quizzle2Answer>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub b64_image: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Quizzle2Answer {
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "type")]
    pub answer_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_correct: Option<bool>,
}
