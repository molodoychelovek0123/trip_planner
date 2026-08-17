document.getElementById("exportBtn").addEventListener("click", async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes("google.com/maps")) {
        document.getElementById("status").innerText = "Please open Google Maps.";
        return;
    }
    
    document.getElementById("status").innerText = "Extracting...";
    
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractPlaces
    }, async (results) => {
        if (results && results[0] && results[0].result) {
            const places = results[0].result;
            if (places.length === 0) {
                document.getElementById("status").innerText = "No places found. Are you on a list page?";
                return;
            }
            
            document.getElementById("status").innerText = `Found ${places.length} places. Sending to server...`;
            
            try {
                // Send to our backend
                const response = await fetch("http://localhost:8000/api/import/extension-list", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ places: places })
                });
                
                const data = await response.json();
                if (data.status === "success") {
                    document.getElementById("status").innerText = `Success! Imported ${data.imported_places.length} places.`;
                } else {
                    document.getElementById("status").innerText = "Error: " + data.detail;
                }
            } catch (err) {
                document.getElementById("status").innerText = "Failed to connect to backend.";
            }
        }
    });
});

function extractPlaces() {
    const places = [];
    // Google Maps lists usually contain links to places.
    // The aria-label of the link often contains the place name, or it's in a specific class.
    // A robust heuristic: find all <a> tags that point to a place.
    const links = document.querySelectorAll('a[href*="/maps/place/"]');
    
    const uniqueNames = new Set();
    
    links.forEach(link => {
        const ariaLabel = link.getAttribute('aria-label');
        if (ariaLabel) {
            uniqueNames.add(ariaLabel);
        } else {
            // fallback: extract from URL
            const match = link.href.match(/\\/maps\\/place\\/([^\\/]+)\\//);
            if (match) {
                const name = decodeURIComponent(match[1].replace(/\\+/g, " "));
                if (name && !name.includes("!")) {
                    uniqueNames.add(name);
                }
            }
        }
    });
    
    // Also try looking for elements with role="article" and get their text
    const articles = document.querySelectorAll('[role="article"]');
    articles.forEach(article => {
        const text = article.innerText;
        if (text) {
            // First line of article is usually the name
            const firstLine = text.split('\\n')[0];
            if (firstLine && firstLine.length > 2) {
                uniqueNames.add(firstLine);
            }
        }
    });
    
    uniqueNames.forEach(name => {
        places.push({ name: name });
    });
    
    return places;
}
