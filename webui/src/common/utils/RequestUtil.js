// Run a plain request with all default values
export const request = async (path, method = "GET", body = {}, headers = {}) => {
    return await fetch("/api" + path, {
        headers: {"content-type": "application/json", ...headers}, method,
        body: method !== "GET" ? JSON.stringify(body) : undefined
    });
}

// Run a GET request and get the json of the response
export const jsonRequest = async (path, headers = {}) => {
    try {
        const resp = await request(path, "GET", null, headers);
        return await resp.json();
    } catch (e) {
        throw e;
    }
}

// Run a POST request and post some values
export const postRequest = async (path, body = {}, headers = {}) => {
    try {
        const resp = await request(path, "POST", body, headers);
        return await resp.json();
    } catch (e) {
        throw e;
    }
}