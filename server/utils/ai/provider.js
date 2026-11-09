class AIProvider {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.model = config.model;
        this.baseUrl = config.baseUrl;
    }

    getSystemPrompt(options = {}) {
        if (options.mode === 'metadata') return this.getMetadataSystemPrompt();
        return this.getQuizSystemPrompt();
    }

    getUserPrompt(options = {}) {
        if (options.mode === 'metadata') return this.getMetadataUserPrompt(options);
        return this.getQuizUserPrompt(options);
    }

    getQuizSystemPrompt() {
        return `You are an expert quiz creator for Quizzle, an educational quiz platform. You generate quiz questions about a given topic.

You MUST respond with valid JSON only - no markdown, no explanation, no wrapping.

You support 5 question types:
1. "multiple-choice" — 2 to 6 answer options, each with "type": "text", "content": string, "is_correct": boolean. At least one must be correct.
2. "true-false" — exactly 2 answers: one with content "Wahr" and one "Falsch", each with "type": "text", "is_correct": boolean. Exactly one must be correct.
3. "text" — 1 to 10 accepted text answers, each with "content": string (the correct text answer). IMPORTANT: Text answers must be short, simple, well-known words that students can realistically type and guess (e.g. a capital city, a famous person's last name, a single keyword). Never use this type for complex terms, long phrases, or obscure answers. Include common spelling variations and abbreviations as additional accepted answers where appropriate.
4. "sequence" — 2 to 8 items that must be sorted in the correct order, each with "content": string, "order": number (1-based, representing the correct position).
5. "slider" — a single numeric answer on a range. Answers array has exactly one object with: "correctValue": number, "min": number, "max": number, "step": number (positive), "answerMargin": "none"|"low"|"medium"|"high"|"maximum". Use only when the answer is a specific number (e.g. a year, a quantity, a measurement). Use this type sparingly — at most 1-2 per quiz.

   CRITICAL for slider ranges — avoid predictability:
   - NEVER place the correctValue at or near the center of the range. The player should not be able to guess by sliding to the middle.
   - Randomize the position of correctValue within [min, max]: sometimes near the lower third, sometimes near the upper third, sometimes off-center — but never centered.
   - Choose wide, varied, non-obvious ranges. Avoid always picking "round" endpoints like 0-100, 1900-2000, 0-1000. Use asymmetric, unexpected bounds (e.g. 1823-1978 for a year that is 1914, or 12-480 for a value that is 73).
   - The range [min, max] should be plausible for the domain but wide enough to make guessing hard (typically the correctValue should only occupy ~10-40% of the distance from one endpoint).
   - Every slider question in the same quiz must use a different ratio/position — do not repeat the same layout.

Rules:
- Generate a varied mix of question types appropriate for the topic
- Question titles must be clear and concise (max 200 characters)
- Answer content must be max 150 characters
- Make questions educational and interesting
- Include some easy, medium, and hard questions
- All text should be in German
- Research the topic thoroughly and ensure factual accuracy
- If a context/source text is provided, base the questions strictly on the facts in that source. Do not invent information that contradicts or goes beyond the source.

Respond with a JSON array where each element is a question object:
{
  "title": "Question text here?",
  "type": "multiple-choice|true-false|text|sequence|slider|word-cloud",
  "imageQuery": "short English image search term",
  "answers": [...]
}

The "imageQuery" field is REQUIRED for every question. It will be used to search a stock photo library (Unsplash). Provide 2-4 English keywords that would find a visually compelling, relevant photo for this question. Focus on the subject matter, not the question itself. Examples:
- Question about the Eiffel Tower → "eiffel tower paris"
- Question about photosynthesis → "green leaves sunlight"
- Question about World War 2 → "world war 2 historical"
- Question about a famous painter → "painting art gallery"

For multiple-choice answers: [{"type": "text", "content": "Answer", "is_correct": true/false}, ...]
For true-false answers: [{"type": "text", "content": "Wahr", "is_correct": true}, {"type": "text", "content": "Falsch", "is_correct": false}]
For text answers: [{"content": "accepted answer"}, ...]
For sequence answers: [{"content": "Item", "order": 1}, {"content": "Item", "order": 2}, ...]
For slider answers: [{"correctValue": 1945, "min": 1912, "max": 1998, "step": 1, "answerMargin": "medium"}] (note: correctValue is off-center within [min, max], not in the middle)
For word-cloud answers: []. This is an ungraded brainstorming prompt where each student submits one word or short phrase (up to 40 characters). Set "pointMultiplier": "none". Include this type only when brainstorming or reflection is requested; there are no correct answers.

Generate between 5 and 15 questions depending on how broad the topic is. Use your judgment on the right amount.`;
    }

    getQuizUserPrompt(options) {
        const { topic, questionCount, context, difficulty } = options;
        let prompt = `Erstelle ein Quiz über das folgende Thema: "${topic}"`;
        if (difficulty && difficulty !== 'none') {
            const map = { easy: 'einfach (für Einsteiger)', medium: 'mittel (fortgeschritten)', hard: 'schwer (anspruchsvoll)' };
            prompt += `\n\nSchwierigkeitsgrad: ${map[difficulty] || difficulty}.`;
        }
        if (questionCount) {
            prompt += `\n\nGeneriere genau ${questionCount} Fragen.`;
        }
        if (context && context.trim().length > 0) {
            const trimmed = context.trim().slice(0, 40000);
            prompt += `\n\nNutze ausschließlich den folgenden Quelltext als Wissensgrundlage für die Fragen. Erfinde keine Fakten, die nicht aus dem Text ableitbar sind. Wenn der Text zu kurz ist, generiere lieber weniger, aber hochwertige Fragen.\n\n---BEGIN SOURCE---\n${trimmed}\n---END SOURCE---`;
        }
        return prompt;
    }

    getMetadataSystemPrompt() {
        return `You generate metadata (title and description) for quizzes on Quizzle, a German educational quiz platform.

You MUST respond with valid JSON only — no markdown, no explanation, no wrapping. The output must be exactly:
{"title": "...", "description": "..."}

Rules:
- Language: German
- "title": short, catchy quiz title (max 60 characters, no quotes, no trailing punctuation)
- "description": one concise sentence summarising what the quiz covers (max 280 characters)
- Do not include any other fields.`;
    }

    getMetadataUserPrompt(options) {
        const { topic, context } = options;
        let prompt = `Erstelle einen Quiz-Titel und eine Beschreibung`;
        if (topic) prompt += ` für das Thema: "${topic}"`;
        if (context && context.trim().length > 0) {
            const trimmed = context.trim().slice(0, 20000);
            prompt += `\n\nQuelle:\n---BEGIN SOURCE---\n${trimmed}\n---END SOURCE---`;
        }
        prompt += `\n\nAntworte ausschließlich mit einem JSON-Objekt der Form {"title": "...", "description": "..."}.`;
        return prompt;
    }

    async listModels() {
        return [];
    }

    async *generateStream(options) {
        throw new Error('generateStream must be implemented by provider');
    }

    parseQuestions(text) {
        try {
            const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(cleaned);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return null;
        }
    }
}

module.exports = AIProvider;
