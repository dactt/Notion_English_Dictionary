// option page
const saveOptions = () => {
    const token = document.getElementById('token').value.trim();
    const databaseId = document.getElementById('database-id').value.trim();
    const linkedPageId = document.getElementById('linked-page-id').value.trim();

    chrome.storage.sync.set(
        { notionToken: token, databaseId: databaseId, linkedPageId: linkedPageId },
        () => {
            document.getElementById('save-status').innerHTML = "SAVED"
        }
    );
};

document.getElementById('btn-save').addEventListener('click', saveOptions);

document.getElementById("token").addEventListener("input", function () {
    document.getElementById("save-status").innerHTML = ""
});

document.getElementById("database-id").addEventListener("input", function () {
    document.getElementById("save-status").innerHTML = ""
});

document.getElementById("linked-page-id").addEventListener("input", function () {
    document.getElementById("save-status").innerHTML = ""
});

chrome.storage.sync.get(["notionToken", "databaseId", "linkedPageId"], (data) => {
    document.getElementById("token").value = data.notionToken || "";
    document.getElementById("database-id").value = data.databaseId || "";
    document.getElementById("linked-page-id").value = data.linkedPageId || "";
});