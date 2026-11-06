const $ = id => document.getElementById(id);

const KEYPAD = {
  A:2,B:2,C:2,D:3,E:3,F:3,G:4,H:4,I:4,J:5,K:5,L:5,M:6,N:6,O:6,
  P:7,Q:7,R:7,S:7,T:8,U:8,V:8,W:9,X:9,Y:9,Z:9
};

function toDigits(text) {
  return String(text).toUpperCase()
    .replace(/[A-Z]/g, ch => String(KEYPAD[ch]))
    .replace(/\D/g, "");
}

// Reduce a digit string to a 10-digit NANP number, or null.
function toNanp(digits) {
  if (digits.length === 13 && digits.startsWith("001")) digits = digits.slice(3);   // 00 international prefix + country 1
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return null;

  const area = digits.slice(0, 3);
  const exchange = digits.slice(3, 6);

  if (area[0] < "2" || exchange[0] < "2") return null;
  if (area[1] === "1" && area[2] === "1") return null;
  if (exchange[1] === "1" && exchange[2] === "1") return null;

  return digits;
}

export function normalizeNanp(raw) {
  const text = String(raw ?? "")
    .normalize("NFKC")                                   // full-width digits, compatibility dashes
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")  // invisible marks from copied call logs
    .replace(/^\s*tel:/i, "")
    .replace(/\s*(?:,|;|#|\bext\.?|\bextension|\bx)\s*\d{1,6}\s*$/i, "")  // trailing extension
    .trim();
  if (!text) return null;

  // Digits first, read from one contiguous phone-shaped run, so labels and words
  // ("Phone:", "Call me at") are ignored but separate numbers are never merged.
  const runs = text.match(/[+(]?\d[\d\s().\-\u2010-\u2015\u2212]*/g) ?? [];
  const found = [...new Set(runs.map(run => toNanp(run.replace(/\D/g, ""))).filter(Boolean))];
  if (found.length === 1) return found[0];
  if (found.length > 1) return null;   // more than one number: ask for one

  // Vanity fallback (1-800-FLOWERS): map letters only from the first digit onward.
  const start = text.search(/[+\d]/);
  if (start === -1) return null;
  return toNanp(toDigits(text.slice(start)));
}

export function formatNanp(raw) {
  const digits = normalizeNanp(raw);
  if (!digits) return "";
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
}

export function hyphenNanp(raw) {
  const digits = normalizeNanp(raw);
  if (!digits) return "";
  return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
}

export function buildLookupLinks(raw) {
  const digits = normalizeNanp(raw);
  if (!digits) return null;

  const hyphen = hyphenNanp(digits);
  const onePlus = `1${digits}`;

  return {
    digits,
    display: formatNanp(digits),
    spyDialer: "https://www.spydialer.com/",
    roboKiller: `https://lookup.robokiller.com/p/${hyphen}`,
    callerSmart: `https://www.callersmart.com/phone-number/${hyphen}`,
    truecaller: `https://www.truecaller.com/who-called-me/${onePlus}`,
    nomoRobo: `https://www.nomorobo.com/lookup/${onePlus}`,
    webSearch: `https://www.google.com/search?q=${encodeURIComponent(`"${hyphen}"`)}`
  };
}

const IDLE_HELP = "U.S., Canada & other +1 regions · 10 digits or +1 · one number at a time.";

if (typeof document !== "undefined") {
  const form = $("lookup-form");
  const phone = $("phone");
  const result = $("result");
  const status = $("status");

  let current = null;

  const say = text => {
    status.textContent = "";
    setTimeout(() => { status.textContent = text; }, 30);
  };

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  const notice = $("notice");
  const show = text => { notice.textContent = text; notice.hidden = false; };

  function hideResult() {
    current = null;
    result.hidden = true;
    notice.hidden = true;
  }

  function render(raw) {
    const links = buildLookupLinks(raw);
    $("error").textContent = "";

    if (!links) {
      hideResult();
      $("error").textContent = "Enter one 10-digit NANP-format number, optionally prefixed with +1.";
      phone.setAttribute("aria-invalid", "true");
      phone.focus();
      return;
    }

    current = links;
    phone.removeAttribute("aria-invalid");
    $("display-number").textContent = links.display;
    $("robokiller").href = links.roboKiller;
    $("callersmart").href = links.callerSmart;
    $("truecaller").href = links.truecaller;
    $("nomorobo").href = links.nomoRobo;
    $("web-search").href = links.webSearch;
    notice.hidden = true;
    result.hidden = false;
    $("helper").textContent = IDLE_HELP;
    say(`${links.display} is ready. Choose a source to check it.`);
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    render(phone.value);
  });

  phone.addEventListener("input", () => {
    $("error").textContent = "";
    phone.removeAttribute("aria-invalid");

    const links = buildLookupLinks(phone.value);
    if (current && (!links || links.digits !== current.digits)) hideResult();

    $("helper").textContent = links && !current
      ? `Press Enter or select Check to continue with ${links.display}`
      : IDLE_HELP;
  });

  phone.addEventListener("paste", () => {
    setTimeout(() => {
      if (buildLookupLinks(phone.value)) render(phone.value);
    }, 0);
  });

  $("spydialer").addEventListener("click", async () => {
    if (!current) return;
    const ok = await copy(current.display);
    const text = ok
      ? `Copied ${current.display}. Paste it into SpyDialer's search box.`
      : `Couldn't copy automatically. Type ${current.display} into SpyDialer.`;
    show(text);
    say(text);
  });

  $("copy-number").addEventListener("click", async () => {
    if (!current) return;

    const button = $("copy-number");
    if (await copy(current.display)) {
      button.textContent = "Copied";
      say(`Copied ${current.display}.`);
      setTimeout(() => { button.textContent = "Copy number"; }, 1200);
    } else {
      show("Clipboard access is unavailable. Select the number above to copy it.");
      say("Clipboard access is unavailable. Select the number above to copy it.");
    }
  });

  $("clear").addEventListener("click", () => {
    hideResult();
    $("error").textContent = "";
    status.textContent = "";
    phone.value = "";
    phone.removeAttribute("aria-invalid");
    $("helper").textContent = IDLE_HELP;
    phone.focus();
  });
}
