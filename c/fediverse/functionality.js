// Tutorial: https://docs.joinmastodon.org/client/intro/

// this code is (or at least ought to be) front-end design agnostic :3
// basically it just specifies IDs for stuff but other than that like, do what you want we ball

const targetURL = "https://mastodon.social";

const paramSearch = new URLSearchParams(window.location.search).get("search");

const contentInsert = document.getElementById("content-insert");

const templateStatus  = document.getElementById("template-status");
const templateAccount = document.getElementById("template-account");

const buttonLoadStatusesPublic    = document.getElementById("button-load-statuses-public");
const buttonLoadStatusesFollowing = document.getElementById("button-load-statuses-following");
const inputLoadFromSearch         = document.getElementById("input-load-from-search");
const buttonLogIn                 = document.getElementById("button-log-in");

buttonLoadStatusesPublic.onclick    = loadStatusesPublic;
buttonLoadStatusesFollowing.onclick = loadStatusesFollowing;
inputLoadFromSearch.onchange        = loadFromSearch;
buttonLogIn.onclick                 = requestAuthentication;



/*
 * Helper functions
 */

function setCookie(cname, cvalue, exdays) {
    const d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    let expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for (let i = 0; i <ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return null;
}

function isBlank(string) {

    return string.trim().length == 0;
}

function hideElement(element) {

    element.style.display = "none";
}

function embedEmojis(string, emojis) {

    for (const emoji of emojis) {

        string = string.replaceAll(`:${ emoji.shortcode }:`, `<img class="emoji" src="${ emoji.url }">`);
    }

    return string;
}

async function get(endpoint) {

    const response = await fetch(targetURL + endpoint,
        {
            method: "GET",
            headers: {
                "content-type": "application/json"
            }
        }
    );

    if (response.status == 200) {
        
        return response;
        
    } else {
        
        return null;
    }
}



/*
 * yea
 */

async function initAuthentication() {

    // https://docs.joinmastodon.org/client/token/#creating-our-application

    /*
     * 1) coming back from user authentication with code query param => request and cache access token
     * 2) access token is already cached => logged in!
     *
     * if either fail, should reset their corresponding values and restart page
     */

    const accessToken = getCookie("access_token");
    const paramCode = new URLSearchParams(window.location.search).get("code");

    if (accessToken) {

        alert("logged in!!! " + accessToken);
    
    } else if (paramCode) {

        // y'know, this section could be a separate authentication page

        const tokenRequestResponse = await fetch(targetURL + "/oauth/token",
            {
                method: "POST",
                headers: {
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    "client_id":     clientID,
                    "client_secret": clientSecret,
                    "redirect_uri":  "https://www.fatchicks.cc/c/fediverse/",
                    "grant_type":    "authorization_code",
                    "code":          paramCode,
                    "scope":         "read write push"
                })
            }
        );
    
        if (tokenRequestResponse.status != 200) {
            
            alert("Error authenticating: " + response.status);
            return;
        }
        
        const token = await tokenRequestResponse.json();
        const accessToken = token.access_token;

        // cache access_token then reload page without query
        setCookie("access_token", accessToken, 21);
        window.location.replace("?");

    } else {
    
        // not logged in or logging in
    }
}

async function requestAuthentication() {

    /*
     * Register a client application (get client_id and client_secret).
     */
    const applicationRequestResponse = await fetch(targetURL + "/api/v1/apps",
        {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({
                "client_name":   "Test Application",
                "redirect_uris": [ "https://www.fatchicks.cc/c/fediverse/" ],
                "scopes":        "read write push",
                "website":       "https://www.fatchicks.cc/c/fediverse/"
            })
        }
    );

    if (applicationRequestResponse.status != 200) {
        
        alert("Error authenticating: " + applicationRequestResponse.status);
        return;
    }

    const credentialApplication = await applicationRequestResponse.json();
    const clientID              = credentialApplication.client_id;
    const clientSecret          = credentialApplication.client_secret;

    // cache client_id and client_secret for later
    setCookie("client_id", clientID, 21);
    setCookie("client_secret", clientSecret, 21);
    
    /*
     * Tell the user to authorize themselves under that client.
     * 
     * They will then be redirected back to this page where the
     * resulting code will be used to get an access token and
     * log them in.
     */
    window.location.href = `${ targetURL }/oauth/authorize/?client_id=${ clientID }&scope=read+write+push&redirect_uri=https://www.fatchicks.cc/c/fediverse/&response_type=code`;
}

async function insertAccount(account) {

    console.log("DEBUG_ACCT:");
    console.log(account);

    let acctEmbed = templateAccount.content.cloneNode(true);

    acctEmbed.getElementById("avatar").src                   = account.avatar;
    acctEmbed.getElementById("header").style.backgroundImage = `url("${ account.header }")`;
    acctEmbed.getElementById("note").innerHTML               = embedEmojis(account.note, account.emojis); // account.note is never null, just empty, so this is ok :)
    acctEmbed.getElementById("followers-count").innerText    = account.followers_count;
    acctEmbed.getElementById("following-count").innerText    = account.following_count;

    acctEmbed.getElementById("display-name").innerHTML = embedEmojis(
        isBlank(account.display_name)
            ? account.username
            : account.display_name,
        account.emojis
    );

    let accountPart = acctEmbed.getElementById("account");
    accountPart.innerText = "@" + account.acct;
    accountPart.href      = "?search=@" + account.acct;
    
    contentInsert.appendChild(acctEmbed);
}

async function insertStatuses(statuses) {

    console.log("DEBUG_STATUSES:");
    console.log(statuses);

    if (statuses.length == 0) {
        contentInsert.innerHTML += "No statuses to display.";
        return;
    }

    for (const sourceStatus of statuses) {

        // for now just skip any sensitive statuses
        if (sourceStatus.sensitive) {
            continue;
        }

        // initialized the status embed
        let statusEmbed = templateStatus.content.cloneNode(true);

        // if this is a reblog, we need to display the reblog and not this status
        const displayedStatus = sourceStatus.reblog == null ? sourceStatus : sourceStatus.reblog;
        
        if (sourceStatus == displayedStatus) {

            // hide reblogger info
            hideElement(statusEmbed.getElementById("reblogger-account-info"));
            
        } else {

            // fill reblogger info
            const rebloggerAccountPart = statusEmbed.getElementById("reblogger-account");
            rebloggerAccountPart.innerText = "@" + sourceStatus.account.acct;
            rebloggerAccountPart.href      = "?search=@" + sourceStatus.account.acct;
        }

        // account
        {
            statusEmbed.getElementById("display-name").innerHTML = embedEmojis(
                isBlank(displayedStatus.account.display_name)
                    ? displayedStatus.account.username
                    : displayedStatus.account.display_name,
                displayedStatus.account.emojis
            );
            
            statusEmbed.getElementById("avatar").src = displayedStatus.account.avatar;

            const accountPart = statusEmbed.getElementById("account");
            accountPart.innerText = "@" + displayedStatus.account.acct;
            accountPart.href      = "?search=@" + displayedStatus.account.acct;
        }

        // content
        {
            if (isBlank(displayedStatus.content)) {
                hideElement(statusEmbed.getElementById("content"));
            } else {
                statusEmbed.getElementById("content").innerHTML = embedEmojis(displayedStatus.content, displayedStatus.emojis);
            }
        }

        // image gallery
        {
            if (displayedStatus.media_attachments.length == 0) {

                hideElement(statusEmbed.getElementById("images"));
                
            } else {

                let imageEmbed = "";
    
                for (const media of displayedStatus.media_attachments) {
        
                    if (media.type === "image")
                        imageEmbed += `<img src="${ media.url }">`;
                }
    
                statusEmbed.getElementById("images").innerHTML = imageEmbed;
            }
        }

        // analytics
        {
            statusEmbed.getElementById("like-count").innerText    = displayedStatus.favourites_count;
            statusEmbed.getElementById("repost-count").innerText  = displayedStatus.reblogs_count;
            statusEmbed.getElementById("comment-count").innerText = displayedStatus.replies_count;
        }
        
        contentInsert.appendChild(statusEmbed);
    }
}

async function loadFromSearch() {

    window.location.href = "?search=" + inputLoadFromSearch.value.trim().replace("#", "");
}

async function loadFromSearchTerm(term) {

    if (term.trim() === "") {
        
        loadStatusesPublic();
        return;
    }

    // reset context
    buttonLoadStatusesPublic.disabled = false;

    contentInsert.innerHTML = "Loading...";

    // decode what they're trying to search (account or hashtag)
    if (term.charAt(0) === '@') {

        // account search
        const lookupResponse = await get(`/api/v1/accounts/lookup?acct=${ term }`);
        contentInsert.innerHTML = "";
        
        if (lookupResponse) {

            const lookupJson = await lookupResponse.json();

            const acctResponse         = await get(`/api/v1/accounts/${ lookupJson.id }`);
            const acctStatusesResponse = await get(`/api/v1/accounts/${ lookupJson.id }/statuses`);
            
            if (acctResponse && acctStatusesResponse) {

                await insertAccount(await acctResponse.json());
                await insertStatuses(await acctStatusesResponse.json());
                
            } else {
                
                contentInsert.innerHTML = "There was an error.";
            }
            
        } else {
            
            contentInsert.innerHTML = "There was an error.";
        }
        
    } else {
    
        // hashtag search
        const response = await get(`/api/v1/timelines/tag/${ term.replace("#", "") }?limit=40`);
    
        if (response) {

            contentInsert.innerHTML = `<p><strong>Statuses with ${ term }</strong></p>`;
            await insertStatuses(await response.json());
            
        } else {
            
            contentInsert.innerHTML = "There was an error.";
        }
    }
}

async function loadStatusesFollowing() {
    
    // reset context
    buttonLoadStatusesPublic.disabled = false;
    buttonLoadStatusesFollowing.disabled = true;
    inputLoadFromSearch.value = "";

    if (paramSearch)
        window.history.pushState({}, "", "?");
    
    // fetch
    contentInsert.innerHTML = "Loading...";
    
    contentInsert.innerHTML = "Accounts don't exist yet. Why are you here?";
}

async function loadStatusesPublic() { // set context public?

    // reset context
    buttonLoadStatusesPublic.disabled = true;
    buttonLoadStatusesFollowing.disabled = false;
    inputLoadFromSearch.value = "";

    if (paramSearch)
        window.history.pushState({}, "", "?");

    // fetch
    contentInsert.innerHTML = "Loading...";
    const response = await get("/api/v1/timelines/public?limit=40");
    
    if (response) {

        contentInsert.innerHTML = "";
        await insertStatuses(await response.json());
        
    } else {
        
        contentInsert.innerHTML = "There was an error.";
    }
}

async function init() {

    await initAuthentication();

    if (paramSearch) {
        loadFromSearchTerm(paramSearch);
    } else {
        loadStatusesPublic();
    }
}

init();
