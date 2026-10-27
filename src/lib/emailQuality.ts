// Screens signup emails for the welcome discount: throwaway inboxes, obvious fakes
// (test@test.com) and domains that can't receive mail are turned away, and common
// typos of big providers get a "did you mean" instead of a dead address.

import { promises as dns } from "dns";

// Well-known temporary / throwaway inbox services.
const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamailblock.com",
  "sharklasers.com", "grr.la", "pokemail.net", "spam4.me", "10minutemail.com", "10minutemail.net",
  "10minutemail.co.uk", "20minutemail.com", "tempmail.com", "temp-mail.org", "temp-mail.io", "tempmail.net",
  "tempmailo.com", "tempail.com", "tempr.email", "tempinbox.com", "mytemp.email", "yopmail.com", "yopmail.net",
  "yopmail.fr", "trashmail.com", "trashmail.de", "trashmail.net", "getnada.com", "nada.email", "dispostable.com",
  "maildrop.cc", "mailnesia.com", "mailcatch.com", "throwawaymail.com", "fakeinbox.com", "fakemail.net",
  "emailondeck.com", "mintemail.com", "mohmal.com", "moakt.com", "burnermail.io", "spamgourmet.com",
  "spambox.us", "mailpoof.com", "inboxkitten.com", "emailfake.com", "fakemailgenerator.com", "33mail.com",
  "getairmail.com", "mailtemp.net", "tmail.ws", "tmpmail.org", "tmpmail.net", "discard.email", "dropmail.me",
  "mail.tm", "linshiyouxiang.net", "harakirimail.com", "mvrht.com", "anonbox.net", "deadaddress.com",
  "jetable.org", "mailexpire.com", "incognitomail.org", "spamex.com", "mailforspam.com", "byom.de",
  "luxusmail.org", "cock.li", "trbvm.com", "armyspy.com", "cuvox.de", "dayrep.com", "einrot.com", "fleckens.hu",
  "gustr.com", "jourrapide.com", "rhyta.com", "superrito.com", "teleworm.us",
]);

// Domains people type when they don't want to give an email.
const FAKE_DOMAINS = new Set([
  "example.com", "example.org", "example.net", "test.com", "test.org", "testing.com", "fake.com", "fakeemail.com",
  "nomail.com", "noemail.com", "none.com", "no.com", "nope.com", "asdf.com", "qwerty.com", "aaa.com", "abc.com",
  "xyz.com", "123.com", "email.test", "mail.test", "localhost",
]);

// Mailbox names that are obviously made up.
const FAKE_LOCAL = new Set([
  "test", "tester", "testing", "asdf", "asdfasdf", "qwerty", "fake", "fakeemail", "noreply", "no-reply", "none",
  "null", "nobody", "nope", "abc", "abcd", "abc123", "sample", "example", "spam", "junk", "123", "1234", "12345",
  "123456", "xxx", "na", "n/a", "no", "blah", "foo", "bar", "foobar",
]);

// Typos of the big providers, to suggest the right one.
const TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gamil.com": "gmail.com", "gnail.com": "gmail.com",
  "gmaill.com": "gmail.com", "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gmail.cm": "gmail.com",
  "gmai.com": "gmail.com", "gmail.om": "gmail.com", "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com",
  "hotmail.co": "hotmail.com", "hotmail.con": "hotmail.com", "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com",
  "yahoo.co": "yahoo.com", "yahoo.con": "yahoo.com", "outlok.com": "outlook.com", "outlook.co": "outlook.com",
  "outlook.con": "outlook.com", "iclod.com": "icloud.com", "icloud.co": "icloud.com", "icloud.con": "icloud.com",
};

/** Can the domain receive mail? Unsure (DNS timeout) counts as yes, so a slow lookup never blocks a real person. */
async function acceptsMail(domain: string): Promise<boolean> {
  const lookup = (async () => {
    try {
      const mx = await dns.resolveMx(domain);
      if (mx.some((r) => r.exchange && r.exchange !== ".")) return true;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENODATA" && code !== "ENOTFOUND") return true;
      if (code === "ENOTFOUND") return false;
    }
    // No MX record: mail falls back to the domain's own address, if it has one.
    try {
      return (await dns.resolve4(domain)).length > 0;
    } catch {
      return false;
    }
  })();
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 3000));
  return Promise.race([lookup, timeout]);
}

/** Null when the address looks real, otherwise what to tell the person. */
export async function emailProblem(email: string): Promise<string | null> {
  const [local, domain] = email.toLowerCase().split("@");
  if (!local || !domain) return "Please enter a valid email address.";
  if (TYPOS[domain]) return `Did you mean ${local}@${TYPOS[domain]}?`;
  if (DISPOSABLE.has(domain) || [...DISPOSABLE].some((d) => domain.endsWith(`.${d}`)))
    return "Please use your everyday email, not a temporary inbox.";
  if (FAKE_DOMAINS.has(domain) || FAKE_LOCAL.has(local) || /^(.)\1{2,}$/.test(local))
    return "Please enter your real email address so we can send your code.";
  if (!(await acceptsMail(domain))) return `${domain} can't receive email. Please check the address.`;
  return null;
}
