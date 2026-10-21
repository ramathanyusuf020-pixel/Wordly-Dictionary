const searchForm = document.getElementById("search-form");
const wordInput = document.getElementById("word-input");
const result = document.getElementById("result");
const favoritesList = document.getElementById("favorites-list");
const favoritesEmpty = document.getElementById("favorites-empty");
const favoriteCount = document.getElementById("favorite-count");
const themeToggle = document.getElementById("theme-toggle");
const searchButton = document.getElementById("search-button");

function setTheme(theme, savePreference) {
    const isDark = theme === "dark";
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    themeToggle.textContent = isDark ? "Switch to Light Theme" : "Switch to Dark Theme";
    themeToggle.setAttribute("aria-pressed", String(isDark));

    if (savePreference) {
        try {
            localStorage.setItem("worldlyTheme", isDark ? "dark" : "light");
        } catch {
            // The theme still works for this page view when storage is unavailable.
        }
    }
}

let savedTheme = "light";
try {
    savedTheme = localStorage.getItem("worldlyTheme") === "dark" ? "dark" : "light";
} catch {
    savedTheme = "light";
}
setTheme(savedTheme, false);

themeToggle.addEventListener("click", function () {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(nextTheme, true);
});

let favorites = [];

try {
    favorites = JSON.parse(localStorage.getItem("worldlyFavorites") || "[]");
    if (!Array.isArray(favorites)) {
        favorites = [];
    }
} catch {
    favorites = [];
}

function renderFavorites() {
    favoritesList.replaceChildren();
    favoritesEmpty.hidden = favorites.length > 0;
    favoriteCount.textContent = String(favorites.length);
    favorites.forEach(function (word) {
        const item = document.createElement("li");
        const searchWord = document.createElement("button");
        searchWord.type = "button";
        searchWord.className = "favorite-word";
        searchWord.textContent = word;
        searchWord.setAttribute("aria-label", `Look up ${word}`);
        searchWord.addEventListener("click", function () {
            wordInput.value = word;
            searchForm.requestSubmit();
        });

        const removeWord = document.createElement("button");
        removeWord.type = "button";
        removeWord.className = "remove-favorite";
        removeWord.textContent = "Remove";
        removeWord.setAttribute("aria-label", `Remove ${word} from favorites`);
        removeWord.addEventListener("click", function () {
            favorites = favorites.filter(function (favorite) {
                return favorite.toLowerCase() !== word.toLowerCase();
            });
            saveFavorites();
            renderFavorites();
            const currentFavoriteButton = result.querySelector(".favorite-action");
            if (currentFavoriteButton) {
                updateFavoriteButton(currentFavoriteButton, word);
            }
        });

        item.append(searchWord, removeWord);
        favoritesList.appendChild(item);
    });
}

function saveFavorites() {
    try {
        localStorage.setItem("worldlyFavorites", JSON.stringify(favorites));
    } catch {
        result.dataset.notice = "Favorites could not be saved in this browser.";
    }
}

function updateFavoriteButton(button, word) {
    const isFavorite = favorites.some(function (favorite) {
        return favorite.toLowerCase() === word.toLowerCase();
    });
    button.textContent = isFavorite ? "Remove from favorites" : "Save to favorites";
    button.setAttribute("aria-pressed", String(isFavorite));
}

renderFavorites();

searchForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const word = wordInput.value.trim();
    if (!word) {
        result.textContent = "Please enter a word.";
        return;
    }

    result.setAttribute("aria-busy", "true");
    result.removeAttribute("data-notice");
    searchButton.disabled = true;
    searchButton.textContent = "Searching...";
    result.replaceChildren();
    const loadingMessage = document.createElement("p");
    loadingMessage.className = "loading-state";
    loadingMessage.textContent = `Looking up “${word}”…`;
    result.appendChild(loadingMessage);

    try {
        const response = await fetch(
            `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
        );
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`We couldn't find “${word}”. Check the spelling or try another word.`);
            }
            throw new Error("The dictionary is having trouble right now. Please try again shortly.");
        }

        const data = await response.json();
        const entry = data[0];
        if (!entry || !Array.isArray(entry.meanings)) {
            throw new Error("The dictionary returned an unexpected result. Please try another word.");
        }
        result.replaceChildren();

        const heading = document.createElement("h3");
        heading.textContent = entry.word;
        result.appendChild(heading);

        const phonetics = Array.isArray(entry.phonetics) ? entry.phonetics : [];
        const pronunciationData = phonetics.find(function (item) {
            return typeof item.audio === "string" && item.audio.trim();
        });
        if (pronunciationData) {
            const audioPlayer = document.createElement("audio");
            audioPlayer.className = "pronunciation-audio";
            audioPlayer.controls = true;
            audioPlayer.preload = "none";

            const audioSource = document.createElement("source");
            audioSource.src = pronunciationData.audio.startsWith("//")
                ? `https:${pronunciationData.audio}`
                : pronunciationData.audio;
            audioPlayer.appendChild(audioSource);

            const audioLabel = document.createElement("p");
            audioLabel.className = "audio-label";
            audioLabel.textContent = "Listen to pronunciation";
            result.append(audioLabel, audioPlayer);
        }

        if ("speechSynthesis" in window) {
            const speakButton = document.createElement("button");
            speakButton.type = "button";
            speakButton.className = "pronunciation-button";
            speakButton.textContent = "Play pronunciation";
            speakButton.addEventListener("click", function () {
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(new SpeechSynthesisUtterance(entry.word));
            });
            result.appendChild(speakButton);
        } else if (!pronunciationData) {
            const audioUnavailable = document.createElement("p");
            audioUnavailable.className = "audio-unavailable";
            audioUnavailable.textContent = "Audio pronunciation is not available in this browser.";
            result.appendChild(audioUnavailable);
        }

        const favoriteButton = document.createElement("button");
        favoriteButton.type = "button";
        favoriteButton.className = "favorite-action";
        updateFavoriteButton(favoriteButton, entry.word);
        favoriteButton.addEventListener("click", function () {
            const alreadySaved = favorites.some(function (favorite) {
                return favorite.toLowerCase() === entry.word.toLowerCase();
            });
            if (alreadySaved) {
                favorites = favorites.filter(function (favorite) {
                    return favorite.toLowerCase() !== entry.word.toLowerCase();
                });
            } else {
                favorites.push(entry.word);
            }
            saveFavorites();
            renderFavorites();
            updateFavoriteButton(favoriteButton, entry.word);
        });
        result.appendChild(favoriteButton);

        const phonetic = entry.phonetic || phonetics.find(function (item) {
            return item.text;
        })?.text;
        if (phonetic) {
            const pronunciation = document.createElement("p");
            pronunciation.textContent = `Pronunciation: ${phonetic}`;
            result.appendChild(pronunciation);
        }

        let synonyms = [...new Set(entry.meanings.flatMap(function (meaning) {
            return [
                ...(Array.isArray(meaning.synonyms) ? meaning.synonyms : []),
                ...(Array.isArray(meaning.definitions) ? meaning.definitions : []).flatMap(function (definition) {
                    return Array.isArray(definition.synonyms) ? definition.synonyms : [];
                })
            ];
        }).filter(function (synonym) {
            return typeof synonym === "string" && synonym.toLowerCase() !== entry.word.toLowerCase();
        }))];

        if (synonyms.length === 0) {
            try {
                const synonymResponse = await fetch(
                    `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(entry.word)}&max=10`
                );
                if (synonymResponse.ok) {
                    const suggestions = await synonymResponse.json();
                    synonyms = [...new Set(suggestions.map(function (suggestion) {
                        return suggestion.word;
                    }).filter(function (synonym) {
                        return typeof synonym === "string" && synonym.toLowerCase() !== entry.word.toLowerCase();
                    }))];
                }
            } catch {
                // Keep the dictionary entry usable when the synonym service is unavailable.
            }
        }

        const synonymsHeading = document.createElement("h4");
        synonymsHeading.textContent = "Synonyms";
        result.appendChild(synonymsHeading);

        if (synonyms.length) {
            const synonymsList = document.createElement("div");
            synonymsList.className = "synonyms-list";
            synonyms.forEach(function (synonym) {
                const synonymButton = document.createElement("button");
                synonymButton.type = "button";
                synonymButton.className = "synonym-button";
                synonymButton.textContent = synonym;
                synonymButton.setAttribute("aria-label", `Look up ${synonym}`);
                synonymButton.addEventListener("click", function () {
                    wordInput.value = synonym;
                    searchForm.requestSubmit();
                });
                synonymsList.appendChild(synonymButton);
            });
            result.appendChild(synonymsList);
        } else {
            const noSynonyms = document.createElement("p");
            noSynonyms.className = "synonyms-list";
            noSynonyms.textContent = "No synonyms available.";
            result.appendChild(noSynonyms);
        }

        entry.meanings.forEach(function (meaning) {
            const partOfSpeech = document.createElement("h4");
            partOfSpeech.textContent = meaning.partOfSpeech;
            result.appendChild(partOfSpeech);

            const definitionList = document.createElement("ul");
            meaning.definitions.slice(0, 3).forEach(function (item) {
                const listItem = document.createElement("li");
                listItem.textContent = item.definition;
                if (item.example) {
                    const example = document.createElement("p");
                    example.textContent = `Example: ${item.example}`;
                    listItem.appendChild(example);
                }
                definitionList.appendChild(listItem);
            });
            result.appendChild(definitionList);
        });

        if (Array.isArray(entry.sourceUrls) && entry.sourceUrls.length > 0) {
            const source = document.createElement("a");
            source.className = "source-link";
            source.href = entry.sourceUrls[0];
            source.target = "_blank";
            source.rel = "noopener noreferrer";
            source.textContent = "View source ↗";
            result.appendChild(source);
        }
    } catch (error) {
        result.replaceChildren();
        const errorMessage = document.createElement("p");
        errorMessage.className = "error-state";
        errorMessage.setAttribute("role", "alert");
        errorMessage.textContent = error instanceof TypeError
            ? "We couldn't reach the dictionary. Check your connection and try again."
            : error.message;
        result.appendChild(errorMessage);
    } finally {
        result.setAttribute("aria-busy", "false");
        searchButton.disabled = false;
        searchButton.innerHTML = 'Search <span aria-hidden="true">↗</span>';
    }
});



