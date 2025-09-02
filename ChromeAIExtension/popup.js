document.getElementById("summarize-btn").addEventListener("click", async () => {
    const result = document.getElementById("result");

    result.innerHTML = '<div class="loader"></div>';

    const summaryType = document.getElementById("summary-type").value;
    
    // 1 - Get user's API key

    chrome.storage.sync.get(["geminiApiKey"], async (result) => {
        if (!result.geminiApiKey) {
            result.innerHTML = "No API key set. Click the gear icon to add one.";
            return;
        }

    // 2 - Ask content.js for the page text

        chrome.tabs.query({active:true, currentWindow: true}, ([tab]) => {
            chrome.tabs.sendMessage(tab.id, {type: "GET_ARTICLE_TEXT"}, async (res) => {
                if (!res || !res.text) {
                    result.textContent = "Couldn't extract text from this page.";
                    return;
                }

                // 3 - Send text to Gemini
                try {
                    const summary = await getGeminiSummary(res.text, summaryType, result.geminiApiKey);
                    result.innerText = summary;
                } catch (error) {
                    result.innerText = `Error: ${error.message || "Failed to generate summary."}`;
                }
            });
        });
    });
});       

async function getGeminiSummary(rawText, type, apiKey) {
    const max = 20000;
    const text = rawText.length > max ? rawText.slice(0, max) + "..." : rawText;

    const promptMap = {
        brief: `Summarize in 2 - 3 sentences: \n\n${text}`,
        detailed: `Give a detailed summary: \n\n${text}`,
        bullets: `Summarize in 5 - 7 bullet points (start each line with "- "):\n\n${text}`,
    };

    const prompt = promptMap[type] || promptMap.brief;
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }]}],
            }),
        }
    );

    if (!res.ok) {
        const {error} = await res.json();
        throw new Error(error?.message || "Request failed");
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No summary.";
}
