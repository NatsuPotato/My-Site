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

buttonLoadStatusesPublic.onclick    = loadStatusesPublic;
buttonLoadStatusesFollowing.onclick = loadStatusesFollowing;
inputLoadFromSearch.onchange        = loadFromSearch;

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

async function authenticate() {

    // https://docs.joinmastodon.org/client/token/#creating-our-application

    /*
     * there are "function entrance" states:
     *
     * 1) no client => create client and request user authentication
     * 2) coming back from user authentication with code => request and cache access token
     * 3) access token is cached => logged in!
     *
     * if 2 or 3 fail, clear their respective values and go back to 1
     */ 
    
    const paramCode = new URLSearchParams(window.location.search).get("code");

    // first: if (access_token exists in cookies)
    
    if (paramCode) {

        alert("login time!");

        // const authenticationRequestResponse = await fetch(targetURL + "/oauth/token",
        //     {
        //         method: "POST",
        //         headers: {
        //             "content-type": "application/json"
        //         },
        //         body: JSON.stringify({
        //             "client_id":     clientID,
        //             "client_secret": clientSecret,
        //             "redirect_uri":  "urn:ietf:wg:oauth:2.0:oob",
        //             "grant_type":    "client_credentials"
        //         })
        //     }
        // );
    
        // if (authenticationRequestResponse.status != 200) {
            
        //     alert("Error authenticating: " + response.status);
        //     return;
        // }
        
        // const token = await authenticationRequestResponse.json();
        // const accessToken = token.access_token;

        // cache access_token then reload page without query

    } else {
    
        /*
         * Register a client application (get client_id and client_secret)
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

        // cache client_id and client_secret
        
        /*
         * Tell the user to authorize themselves under that client
         */
        window.location.replace(targetURL + `/oauth/authorize/?client_id=${ clientID }&scope=read+write+push&redirect_uri=https://www.fatchicks.cc/c/fediverse/`);
    }
    
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

    await authenticate();

    if (paramSearch) {
        loadFromSearchTerm(paramSearch);
    } else {
        loadStatusesPublic();
    }
}

init();
