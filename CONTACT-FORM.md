# Contact form setup

The contact form posts to Web3Forms, which emails each submission to
nyuconcretecanoe@gmail.com. There is no server involved.

**Two steps. Both are required.** Step 1 makes the form work; step 2 is what
keeps submissions out of the spam folder.

---

## Step 1: Get the access key

1. Go to https://web3forms.com
2. Enter **nyuconcretecanoe@gmail.com** and submit.
3. The access key arrives by email. It is a UUID.
4. In `contact.html`, replace the placeholder:

```html
<input type="hidden" name="access_key" value="REPLACE-WITH-WEB3FORMS-ACCESS-KEY">
```

There is no account or password. The key is tied to the email address, so
nothing needs handing over when officers change. The key is public by design
(it only permits sending to the address it was issued for), so it is safe in a
public repo.

Free tier is roughly 250 submissions/month, which is far above what a club
contact form uses.

---

## Step 2: Stop Gmail marking it as spam

**Do not skip this.** Without it, delivery is unreliable no matter which
service is used.

### Why you cannot fix this on the website

SPF, DKIM and DMARC are the DNS records that prove an email is legitimate. They
are published on the domain that *sends* the mail. The team owns neither
`gmail.com` nor `web3forms.com`, so there are no DNS records you can add. This
is structural, not a configuration you have missed.

What Web3Forms does correctly is send as:

```
From:     notify@web3forms.com     <- passes authentication
Reply-To: the visitor's address    <- so Reply still reaches them
```

A service that instead put the visitor's address in `From:` would be spoofing,
would fail SPF and DKIM, and would land in spam. That is why none of them do it.

Since authentication is out of your hands, the fix belongs on the receiving
account.

### Create the Gmail filter

On **nyuconcretecanoe@gmail.com**:

1. Click the search box, then **Show search options** (the sliders icon).
2. In **From**, enter `notify@web3forms.com`
3. Click **Create filter**.
4. Tick:
   - **Never send it to Spam**
   - **Always mark it as important**
   - **Apply the label** and create a label such as `Website Contact`
5. Click **Create filter**.

Also add `notify@web3forms.com` to Google Contacts. Gmail treats mail from
contacts more favourably. Do both; they are independent signals.

If a message ever does land in spam, open it and click **Not spam** rather than
just dragging it out.

---

## Spam submitted *into* the form

A honeypot field is already in place: a hidden checkbox named `botcheck` that
people never see and simple bots fill in. Web3Forms rejects those submissions.

If real spam starts arriving, add Cloudflare Turnstile. It is free, works on a
static site, and Web3Forms verifies the token for you, so no backend is needed.
Do not add it pre-emptively, since it costs visitors a little friction.

---

## How the form behaves

- **With JavaScript:** submits in place and shows a success or error message
  under the button. Focus moves to that message so screen readers announce it.
- **Without JavaScript:** the plain `action`/`method` on the form still works.
  The visitor is taken to a Web3Forms confirmation page instead. Nothing breaks.
- **If the access key is not filled in:** the script logs a warning and lets the
  normal POST proceed, so the failure is visible rather than silent.

To change the reply address later, generate a new key for the new address and
replace the value in `contact.html`.

---

## If you outgrow this

The only option with genuinely guaranteed delivery is Google Apps Script, since
mail would be sent by Gmail itself from the team's own account and would be
authenticated automatically. It also allows logging submissions to a Google
Sheet. The cost is more setup and a script tied to one Google account, which is
a maintenance risk across officer turnover. Worth it only if spam remains a
problem after step 2.
