import { __strl__ } from "strulink";

// const inUrl = "https://nehonix.com/?q1=test&&q2=ok&&token=82KDUPdhoiaz"
const inUrl = "https://?q1=test&&q2=ok&&token=82KDUPdhoiaz";
const inParms = ["token"];

function masQS(url: string, params: string[]) {
  //   const idx = url.indexOf("?");
  //   if (idx === -1) return url;
  //   const base = url.slice(0, idx);
  //   const qs = new URLSearchParams(url.slice(idx + 1));
  //   for (const key of params) {
  //     if (qs.has(key)) qs.set(key, "***");
  //   }
  //   return `${base}?${qs.toString()}`;
  //   const u = __strl__.checkUrl(url, { requireProtocol: true }).validationDetails;
  //   const qUr = u.protocol?.isValid ? u.parsing?.isValid ? url : `${url.}` : `https://${url}`;
  // const qUr = __strl__.checkUrl(url, {requireProtocol: true})
  //   const qs = __strl__.analyzeURL(qUr);
  //   console.log(qs);
  //   console.log("qUr: ", qUr);
}

console.log(masQS(inUrl, inParms));
