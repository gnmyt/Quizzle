import {faListUl, faToggleOn, faKeyboard, faSort} from "@fortawesome/free-solid-svg-icons";

export const QUESTION_TYPES = {
    MULTIPLE_CHOICE: 'multiple-choice',
    TRUE_FALSE: 'true-false',
    TEXT: 'text',
    SEQUENCE: 'sequence'
};

export const DEFAULT_QUESTION_TYPE = QUESTION_TYPES.MULTIPLE_CHOICE;

export const QUESTION_TYPE_CONFIG = [
    {type: QUESTION_TYPES.MULTIPLE_CHOICE, icon: faListUl, name: 'Auswahlmöglichkeiten', description: 'Spieler wählen aus vorgegebenen Antwortmöglichkeiten'},
    {type: QUESTION_TYPES.TRUE_FALSE, icon: faToggleOn, name: 'Wahr/Falsch', description: 'Spieler wählen zwischen Wahr und Falsch'},
    {type: QUESTION_TYPES.TEXT, icon: faKeyboard, name: 'Text Eingabe', description: 'Spieler geben ihre Antwort als Text ein'},
    {type: QUESTION_TYPES.SEQUENCE, icon: faSort, name: 'Reihenfolge', description: 'Spieler sortieren vorgegebene Antworten in die richtige Reihenfolge'}
];

export const getQuestionTypeConfig = (type) => QUESTION_TYPE_CONFIG.find(config => config.type === type) || QUESTION_TYPE_CONFIG[0];
export const getQuestionTypeIcon = (type) => getQuestionTypeConfig(type).icon;
export const getQuestionTypeName = (type) => getQuestionTypeConfig(type).name;

export const getDefaultAnswersForType = (type) => {
    switch (type) {
        case QUESTION_TYPES.TRUE_FALSE: return [{type: QUESTION_TYPES.TEXT, content: 'Wahr', is_correct: false}, {type: QUESTION_TYPES.TEXT, content: 'Falsch', is_correct: false}];
        case QUESTION_TYPES.TEXT: return [{content: ''}];
        case QUESTION_TYPES.SEQUENCE: return [];
        case QUESTION_TYPES.MULTIPLE_CHOICE:
        default: return [];
    }
};

export const ANSWER_LIMITS = {
    [QUESTION_TYPES.MULTIPLE_CHOICE]: 6,
    [QUESTION_TYPES.TRUE_FALSE]: 2,
    [QUESTION_TYPES.TEXT]: 10,
    [QUESTION_TYPES.SEQUENCE]: 8
};

export const MINIMUM_ANSWERS = {
    [QUESTION_TYPES.MULTIPLE_CHOICE]: 2,
    [QUESTION_TYPES.TRUE_FALSE]: 2,
    [QUESTION_TYPES.TEXT]: 1,
    [QUESTION_TYPES.SEQUENCE]: 2
};