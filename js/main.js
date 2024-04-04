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
            "rich_text": [
                {
                    "type": "text",
                    "text": { "content": wordInfo.exampleSentences },
                }
            ],
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
                    "text": { "content": word },
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
    }
    // Call the createNotionPage function with the pageData
    const rp = await createNotionPage(template);

    if (rp) {
        document.getElementById("status").innerHTML = "Success"
    }
    else {
        document.getElementById("status").innerHTML = "Faile to create Notion page"
    }
};

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

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64)',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch word info');
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const pronunciation = doc.querySelector('.pron').textContent;
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

        defBlocks.forEach((defBlock) => {
            const def_card = defBlock.querySelector('.def');
            if (def_card) {
                const def = def_card.textContent.replace(':', '').trim();
                if (meaning.includes(def)){
                    return;
                };
                if (meaning.length + def.length < 1900) {
                    meaning += `- ${def}\n`;
                }
            };


            const examples = defBlock.querySelectorAll('.examp');
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
            pronunciation,
            meaning,
            exampleSentences,
            partOfSpeech,
        };
    } catch (error) {
        return {
            pronunciation: '',
            meaning: '',
            exampleSentences: '',
            partOfSpeech: [],
        };
    }
}


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
