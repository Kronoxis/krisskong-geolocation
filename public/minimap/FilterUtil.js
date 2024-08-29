/**
 * 
 * @param {Record<string, "*" | string[] | Record<string, "*" | string[]>} filters Node filter queries
 * @returns {string} Overpass API structured filter
 */
export function composeFilter(filters) {
    let selection = "";
    for (const key in filters) {
        const filter = filters[key];
        if (filter === "*") {
            selection += `way["${key}"];`;
        } else if (Array.isArray(filter)) {
            for (const value of filter) selection += `way["${key}"="${value}"];`;
        } else {
            for (const tag in filter) {
                const values = filter[tag];
                if (values === "*") {
                    selection += `way["${key}"]["${tag}"];`;
                } else {
                    for (const value of values) selection += `way["${key}"]["${tag}"="${value}"];`;
                }
            }
        }
    }
    return selection;
}