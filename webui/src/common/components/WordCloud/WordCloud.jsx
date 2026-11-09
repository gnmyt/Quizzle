import './styles.sass';

const COLORS = ['#6547ee', '#1463b3', '#146a50', '#a23d68', '#8b5911'];

export const WordCloud = ({words = [], totalResponses = 0}) => {
    const maxCount = Math.max(1, ...words.map(word => word.count));
    const groups = new Map();
    for (const word of words) {
        const key = word.group || word.text.toLowerCase();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(word);
    }

    return (
        <section className="word-cloud" aria-label="Wortwolke">
            <p className="word-cloud-summary" aria-live="polite">
                {totalResponses} {totalResponses === 1 ? 'Antwort' : 'Antworten'} · {words.length} {words.length === 1 ? 'Begriff' : 'Begriffe'}
            </p>
            {words.length === 0 ? (
                <p className="word-cloud-empty">Die Wortwolke wächst mit euren Antworten.</p>
            ) : (
                <ul className="word-cloud-words">
                    {[...groups.entries()].map(([key, entries], index) => (
                        <li key={key} className="word-cloud-group" aria-label={entries.length > 1 ? 'Ähnliche Begriffe' : undefined}>
                            {entries.map(word => {
                                const weight = Math.log1p(word.count) / Math.log1p(maxCount);
                                return (
                                    <span key={word.text} className="word-cloud-word"
                                          style={{color: COLORS[index % COLORS.length], fontSize: `clamp(${1 + weight * 0.8}rem, ${1 + weight * 2.5}vw, ${1.1 + weight * 2}rem)`}}
                                          aria-label={`${word.text}: ${word.count} ${word.count === 1 ? 'Antwort' : 'Antworten'}`}>
                                        {word.text}<small className="word-cloud-count" aria-hidden="true">{word.count}</small>
                                    </span>
                                );
                            })}
                        </li>
                    ))}
                </ul>
            )}
            {words.length > 0 && <p className="word-cloud-hint">Ähnliche Schreibweisen stehen nebeneinander.</p>}
        </section>
    );
};
