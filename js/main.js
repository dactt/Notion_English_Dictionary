async function pushToNotion() {
    document.getElementById("status").innerHTML = "Waiting..."
    const word = document.getElementById("input-text").value.trim()
    if (word == "") {
        document.getElementById("status").innerHTML = "It is empty"
        return 0
    };

    const flat = await isDuplicatedWord(word)
    if (flat) {
        document.getElementById("status").innerHTML = "Duplicate"
        return 0
    }
    const wordInfo = await getWordInfo(word);
    linked_page = await chrome.storage.sync.get(["linkedPageId"])
    if (wordInfo.pronunciation == "") {
        document.getElementById("status").innerHTML = "Can not find <b>" + word + "</b> in the dictionary"
        return 0
    }
    const POS = {
        "noun": { "name": "n", "color": "yellow" },
        "verb": { "name": "v", "color": "green" },
        "adjective": { "name": "adj", "color": "blue" },
        "adverb": { "name": "adv", "color": "red" },
        "interjection": { "name": "intj", "color": "purple" },
        "conjunction": { "name": "conj", "color": "brown" },
        "preposition": { "name": "prep", "color": "pink" },
        "pronoun": { "name": "pron", "color": "gray" },
    }
    pos_array = []
    wordInfo.partOfSpeech.forEach((pos) => {
        if (POS[pos]) {
            pos_array.push(POS[pos])
        }
    })

    rich_text = anotation(wordInfo.exampleSentences, word, "red")

    var template = {
        "pronounce": {
            "type": "rich_text",
            "rich_text": [
                {
                    "type": "text",
                    "text": { "content": wordInfo.pronunciation },
                }
            ],
        },
        "spoiled": { "type": "checkbox", "checkbox": true },
        "sentence/note": {
            "type": "rich_text",
            "rich_text": rich_text,
        },
        "meaning": {
            "type": "rich_text",
            "rich_text": [
                {
                    "type": "text",
                    "text": {
                        "content": wordInfo.meaning,
                    },
                }
            ],
        },
        "word": {
            "type": "title",
            "title": [
                {
                    "type": "text",
                    "text": { "content": wordInfo.baseWord },
                }
            ],
        },
        "part(s) of speech": {
            "type": "multi_select",
            "multi_select": pos_array
        },
        "to stats": {
            "type": "relation",
            "relation": [{ "id": linked_page.linkedPageId }],
        },
        "Vietnamese": {
            "type": "rich_text",
            "rich_text": [
                {
                    "type": "text",
                    "text": {
                        "content": wordInfo.Vietnamese,
                    },
                }
            ],
        },
    }

    const rp = await createNotionPage(template);

    if (rp) {
        document.getElementById("status").innerHTML = "Success"
    }
    else {
        document.getElementById("status").innerHTML = "Faile to create Notion page"
    }
};

function anotation(sentence, word, color) {
    let lowerCaseSentence = sentence.toLowerCase()
    let currentPos = 0
    let result = []
    const re = /[^a-zA-Z]/g
    const nonAphabet = lowerCaseSentence.matchAll(re)
    while (lowerCaseSentence.indexOf(word, currentPos) != -1) {
        let fontPos = 0
        let backPos = lowerCaseSentence.length
        let wordPos = lowerCaseSentence.indexOf(word, currentPos)

        for (const pos of nonAphabet) {
            if (pos.index < wordPos) {
                fontPos = pos.index;
            }
            else {
                backPos = pos.index;
                break;
            }
        }
        result.push({
            "type": "text",
            "text": {
                "content": sentence.slice(currentPos, fontPos),
            },
        })

        result.push({
            "type": "text",
            "text": {
                "content": sentence.slice(fontPos, backPos),
            },
            "annotations": {
                "color": color
            },
        })
        currentPos = backPos
    }
    return result
}

async function createNotionPage(data) {
    const createPageUrl = "https://api.notion.com/v1/pages";

    auth = await chrome.storage.sync.get(["notionToken", "databaseId"])

    const YOUR_AUTH_TOKEN = auth.notionToken;
    const DATABASE_ID = auth.databaseId;
    const icon = {
        "type": "external",
        "external": { "url": "https://www.notion.so/icons/bookmark_gray.svg" }
    };
    const payload = { "parent": { "database_id": DATABASE_ID }, "properties": data, "icon": icon };

    const response = await fetch(createPageUrl, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + YOUR_AUTH_TOKEN, // Replace with your Notion API token
            'Content-Type': 'application/json',
            "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify(payload),
    })

    if (!response.ok) {
        return false
    }
    else {
        return true
    }
}

async function isDuplicatedWord(word) {
    auth = await chrome.storage.sync.get(["notionToken", "databaseId"])
    const YOUR_AUTH_TOKEN = auth.notionToken;
    const DATABASE_ID = auth.databaseId;
    const databaseQueryUrl = `https://api.notion.com/v1/databases/${DATABASE_ID}/query`;

    const filter = {
        "and": [
            {
                "property": "title",
                "title": {
                    "equals": word
                }
            }
        ]
    }
    const payload = { "filter": filter };

    const response = await fetch(databaseQueryUrl, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + YOUR_AUTH_TOKEN, // Replace with your Notion API token
            'Content-Type': 'application/json',
            "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify(payload),
    })

    if (!response.ok) {
        return false
    }
    else {
        const content = await response.json()
        if (content["results"].length == 0) {
            return false
        }
        return true
    }
}

async function getWordInfo(word) {
    const url = `https://dictionary.cambridge.org/dictionary/english/${word}`;
    const url_vn = `https://dictionary.cambridge.org/dictionary/english-vietnamese/${word}`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64)',
            },
        });

        const response_vn = await fetch(url_vn, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64)',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch word info');
        }
        let Vietnamese = '';
        if (response_vn.ok) {
            const html_vn = await response_vn.text();
            const parser_vn = new DOMParser();
            const doc_vn = parser_vn.parseFromString(html_vn, 'text/html');
            const vietnamese_blocks = doc_vn.querySelectorAll('.trans');
            vietnamese_blocks.forEach((vietnamese_block) => {
                Vietnamese += `- ${vietnamese_block.textContent}\n`;
            })
        }
        Vietnamese = Vietnamese.trim()
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const pronunciation = doc.querySelector('.us.dpron-i').querySelector('.pron').textContent;
        const baseWord = doc.querySelector('.headword').textContent;
        let meaning = '';
        let exampleSentences = '';
        let partOfSpeechAll = [];

        const pos = doc.querySelectorAll('.pos');
        if (pos) {
            pos.forEach((pos) => {
                const posText = partOfSpeechAll.push(pos.textContent.trim());
            });
        }

        const defBlocks = doc.querySelectorAll('.def-block');
        var def_array = []
        defBlocks.forEach((defBlock) => {
            var is_accepted = true
            const def_card = defBlock.querySelector('.def');
            if (def_card) {
                const def = def_card.textContent.replace(':', '').trim();
                if (meaning.includes(def)) {
                    return;
                };
                def_array.forEach((accepted_def) => {
                    if (stringSimilarity.compareTwoStrings(accepted_def, def) > 0.7) {
                        is_accepted = false
                        return;
                    }
                });
                if (!is_accepted) {
                    return;
                }
                if (meaning.length + def.length < 1900) {
                    def_array.push(def)
                    meaning += `- ${def}\n`;
                }
            };


            const examples = defBlock.querySelectorAll('.eg');
            if (examples) {
                examples.forEach((example) => {
                    const exampleText = example.textContent.trim();
                    if (exampleSentences.length + exampleText.length < 1900) {
                        exampleSentences += `- ${exampleText}\n`;
                    }
                });
            }
            exampleSentences += `\n`;
        });

        const partOfSpeech = [...new Set(partOfSpeechAll)];
        exampleSentences = exampleSentences.trim(),
            meaning = meaning.trim()
        return {
            baseWord,
            pronunciation,
            meaning,
            exampleSentences,
            partOfSpeech,
            Vietnamese,
        };
    } catch (error) {
        return {
            baseWord: word,
            pronunciation: '',
            meaning: '',
            exampleSentences: '',
            partOfSpeech: [],
            Vietnamese: '',
        };
    }
}

! function (t, e) {
    "object" == typeof exports && "object" == typeof module ? module.exports = e() : "function" == typeof define && define.amd ? define([], e) : "object" == typeof exports ? exports.stringSimilarity = e() : t.stringSimilarity = e()
}(self, (function () {
    return t = {
        138: t => {
            function e(t, e) {
                if ((t = t.replace(/\s+/g, "")) === (e = e.replace(/\s+/g, ""))) return 1;
                if (t.length < 2 || e.length < 2) return 0;
                let r = new Map;
                for (let e = 0; e < t.length - 1; e++) {
                    const n = t.substring(e, e + 2),
                        o = r.has(n) ? r.get(n) + 1 : 1;
                    r.set(n, o)
                }
                let n = 0;
                for (let t = 0; t < e.length - 1; t++) {
                    const o = e.substring(t, t + 2),
                        s = r.has(o) ? r.get(o) : 0;
                    s > 0 && (r.set(o, s - 1), n++)
                }
                return 2 * n / (t.length + e.length - 2)
            }
            t.exports = {
                compareTwoStrings: e,
                findBestMatch: function (t, r) {
                    if (! function (t, e) {
                        return "string" == typeof t && !!Array.isArray(e) && !!e.length && !e.find((function (t) {
                            return "string" != typeof t
                        }))
                    }(t, r)) throw new Error("Bad arguments: First argument should be a string, second should be an array of strings");
                    const n = [];
                    let o = 0;
                    for (let s = 0; s < r.length; s++) {
                        const i = r[s],
                            f = e(t, i);
                        n.push({
                            target: i,
                            rating: f
                        }), f > n[o].rating && (o = s)
                    }
                    return {
                        ratings: n,
                        bestMatch: n[o],
                        bestMatchIndex: o
                    }
                }
            }
        }
    }, e = {},
        function r(n) {
            if (e[n]) return e[n].exports;
            var o = e[n] = {
                exports: {}
            };
            return t[n](o, o.exports, r), o.exports
        }(138);
    var t, e
}));

let isFunctionRunning = false;
let lastExecutionTime = 0;
const throttleThreshold = 1000;
function throttledFunction() {
    const now = Date.now();
    if (now - lastExecutionTime >= throttleThreshold) {
        lastExecutionTime = now;
        pushToNotion();
    }
}


document.getElementById('btn-import').addEventListener('click', throttledFunction)
document.addEventListener("keypress", function (event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        throttledFunction();
    }
})
document.getElementById("input-text").addEventListener("input", function () {
    document.getElementById("status").innerHTML = ""
});
