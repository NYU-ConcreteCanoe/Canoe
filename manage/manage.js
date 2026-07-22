/* Timeline manager: edit canoe photos/text via the GitHub API. */

(function () {
  "use strict";

  var REPO = { owner: "NYU-ConcreteCanoe", name: "Canoe", branch: "main" };

  var API = "https://api.github.com";
  var TOKEN_KEY = "cc_manage_token";
  var IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)$/i;

  // Downscale big phone photos before upload.
  var MAX_DIM = 2000;
  var WEBP_QUALITY = 0.82;

  var state = {
    token: null,
    canoesDoc: null, // full parsed canoes.json
    canoes: [], // alias to canoesDoc.canoes
    canoesSha: null,
    mode: null, // "existing" | "new"
    year: null,
  };

  // Staged per open year; reset on re-render.
  var pendingUploads = [];
  var pendingDeletes = [];
  var currentTags = [];

  /* ----------------------------- tiny helpers ---------------------------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function toast(message, kind, opts) {
    opts = opts || {};
    var box = $("#toast");
    var t = el("div", { class: "toast " + (kind || "") }, message);
    box.appendChild(t);
    var ttl = opts.sticky ? 12000 : 4500;
    setTimeout(function () { t.remove(); }, ttl);
  }

  /* --------------------------- base64 <-> bytes -------------------------- */

  function decodeBase64Utf8(b64) {
    var bin = atob(String(b64).replace(/\n/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  // Blob -> raw base64 for the git blobs API.
  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        var s = String(r.result);
        resolve(s.slice(s.indexOf(",") + 1));
      };
      r.onerror = function () { reject(new Error("Could not read file")); };
      r.readAsDataURL(blob);
    });
  }

  /* ------------------------------ GitHub API ----------------------------- */

  function gh(path, opts) {
    opts = opts || {};
    var headers = {
      Authorization: "Bearer " + state.token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (opts.body) headers["Content-Type"] = "application/json";
    if (opts.headers) Object.keys(opts.headers).forEach(function (k) { headers[k] = opts.headers[k]; });

    return fetch(API + path, { method: opts.method || "GET", headers: headers, body: opts.body })
      .then(function (res) {
        if (res.status === 204) return null;
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) {
            var msg = (data && data.message) ? data.message : "HTTP " + res.status;
            if (res.status === 401) msg = "Token rejected (401). Sign out and paste a fresh token.";
            else if (res.status === 403) msg = "Not allowed (403). The token likely lacks Contents write access to this repo. " + msg;
            else if (res.status === 404) msg = "Not found (404). " + msg;
            else if (res.status === 409 || res.status === 422) msg = "Someone else changed the repo while you were editing. Reload and try again. " + msg;
            var e = new Error(msg);
            e.status = res.status;
            throw e;
          }
          return data;
        });
      });
  }

  function loadCanoes() {
    return gh("/repos/" + REPO.owner + "/" + REPO.name + "/contents/assets/data/canoes.json?ref=" + REPO.branch)
      .then(function (data) {
        state.canoesSha = data.sha;
        state.canoesDoc = JSON.parse(decodeBase64Utf8(data.content));
        state.canoes = state.canoesDoc.canoes || (state.canoesDoc.canoes = []);
      });
  }

  function listYearImages(year) {
    return gh("/repos/" + REPO.owner + "/" + REPO.name + "/contents/assets/img/canoes/" + year + "?ref=" + REPO.branch)
      .then(function (items) {
        return (items || [])
          .filter(function (it) { return it.type === "file" && IMAGE_RE.test(it.name); })
          .map(function (it) { return { name: it.name, path: it.path, sha: it.sha, url: it.download_url }; })
          .sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true }); });
      })
      .catch(function (e) {
        if (e.status === 404) return []; // year folder not created yet
        throw e;
      });
  }

  /* --------------------------- image processing -------------------------- */

  function safeBase(name) {
    return (name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")) || "photo";
  }

  // Downscale (never upscale) and re-encode to WebP.
  function processImage(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\//.test(file.type)) return reject(new Error("Not an image: " + file.name));
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth, h = img.naturalHeight;
        if (w > MAX_DIM || h > MAX_DIM) {
          var s = Math.min(MAX_DIM / w, MAX_DIM / h);
          w = Math.round(w * s); h = Math.round(h * s);
        }
        var canvas = el("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(function (blob) {
          if (!blob) return reject(new Error("Could not process " + file.name));
          resolve({ blob: blob, base: safeBase(file.name) });
        }, "image/webp", WEBP_QUALITY);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Could not read image: " + file.name)); };
      img.src = url;
    });
  }

  // Names already used this year, so uploads never overwrite.
  function takenNames(existing) {
    var taken = {};
    existing.forEach(function (f) {
      if (pendingDeletes.indexOf(f.path) === -1) taken[f.name.toLowerCase()] = true;
    });
    pendingUploads.forEach(function (u) { taken[u.filename.toLowerCase()] = true; });
    return taken;
  }

  function uniqueName(base, ext, taken) {
    var name = base + ext;
    var n = 1;
    while (taken[name.toLowerCase()]) { name = base + "-" + n + ext; n++; }
    return name;
  }

  /* --------------------------- publish (1 commit) ------------------------ */

  function buildCanoesContent(nextCanoes) {
    var doc = {};
    // Preserve other top-level keys; swap in the list.
    Object.keys(state.canoesDoc).forEach(function (k) {
      doc[k] = k === "canoes" ? nextCanoes : state.canoesDoc[k];
    });
    if (!("canoes" in doc)) doc.canoes = nextCanoes;
    return JSON.stringify(doc, null, 2) + "\n";
  }

  function publish(opts) {
    var o = REPO.owner, r = REPO.name, b = REPO.branch;
    var base = "/repos/" + o + "/" + r;
    var latestCommitSha, baseTreeSha;

    return gh(base + "/git/ref/heads/" + b)
      .then(function (ref) {
        latestCommitSha = ref.object.sha;
        return gh(base + "/git/commits/" + latestCommitSha);
      })
      .then(function (commit) {
        baseTreeSha = commit.tree.sha;
        // A blob per new image, sequentially.
        var chain = Promise.resolve();
        var tree = [];
        pendingUploads.forEach(function (up) {
          chain = chain
            .then(function () { return blobToBase64(up.blob); })
            .then(function (b64) {
              return gh(base + "/git/blobs", { method: "POST", body: JSON.stringify({ content: b64, encoding: "base64" }) });
            })
            .then(function (blob) {
              tree.push({ path: up.path, mode: "100644", type: "blob", sha: blob.sha });
            });
        });
        return chain.then(function () { return tree; });
      })
      .then(function (tree) {
        // Null sha removes a path.
        pendingDeletes.forEach(function (p) {
          tree.push({ path: p, mode: "100644", type: "blob", sha: null });
        });
        // Inline updated canoes.json.
        if (opts.canoesContent != null) {
          tree.push({ path: "assets/data/canoes.json", mode: "100644", type: "blob", content: opts.canoesContent });
        }
        return gh(base + "/git/trees", { method: "POST", body: JSON.stringify({ base_tree: baseTreeSha, tree: tree }) });
      })
      .then(function (newTree) {
        return gh(base + "/git/commits", {
          method: "POST",
          body: JSON.stringify({ message: opts.message, tree: newTree.sha, parents: [latestCommitSha] }),
        });
      })
      .then(function (newCommit) {
        return gh(base + "/git/refs/heads/" + b, { method: "PATCH", body: JSON.stringify({ sha: newCommit.sha }) })
          .then(function () { return newCommit.sha; });
      });
  }

  /* ------------------------------ rendering ------------------------------ */

  function renderYearList() {
    var ul = $("#yearList");
    ul.innerHTML = "";
    var years = state.canoes.slice().sort(function (a, b) { return Number(b.year) - Number(a.year); });
    years.forEach(function (c) {
      var li = el("li");
      var btn = el("button", { "data-year": c.year, class: state.year === Number(c.year) && state.mode === "existing" ? "active" : "" });
      btn.innerHTML = "<span>" + esc(c.year) + " &middot; " + esc(c.name || "Untitled") + "</span>";
      btn.addEventListener("click", function () { openYear(Number(c.year)); });
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  function renderTags() {
    var box = $("#tagBox");
    if (!box) return;
    box.innerHTML = "";
    currentTags.forEach(function (tag, i) {
      var chip = el("span", { class: "tag-chip" }, esc(tag));
      var x = el("button", { type: "button", "aria-label": "Remove tag " + esc(tag) }, "&times;");
      x.addEventListener("click", function () { currentTags.splice(i, 1); renderTags(); });
      chip.appendChild(x);
      box.appendChild(chip);
    });
  }

  function renderPhotoGrid(existing) {
    var grid = $("#photoGrid");
    grid.innerHTML = "";

    existing.forEach(function (f) {
      var marked = pendingDeletes.indexOf(f.path) !== -1;
      var cell = el("div", { class: "thumb" + (marked ? " marked-delete" : "") });
      cell.appendChild(el("img", { src: f.url, alt: esc(f.name), loading: "lazy" }));
      var x = el("button", { class: "thumb-x btn-sm", "aria-label": (marked ? "Keep " : "Delete ") + f.name, title: marked ? "Keep this photo" : "Delete this photo" },
        '<i class="fa fa-' + (marked ? "undo" : "trash") + '"></i>');
      x.addEventListener("click", function () {
        var idx = pendingDeletes.indexOf(f.path);
        if (idx === -1) pendingDeletes.push(f.path); else pendingDeletes.splice(idx, 1);
        renderPhotoGrid(existing);
      });
      cell.appendChild(x);
      grid.appendChild(cell);
    });

    pendingUploads.forEach(function (u, i) {
      var cell = el("div", { class: "thumb pending" });
      cell.appendChild(el("img", { src: u.previewURL, alt: esc(u.filename) }));
      var x = el("button", { class: "thumb-x btn-sm", "aria-label": "Remove " + u.filename, title: "Remove" }, '<i class="fa fa-times"></i>');
      x.addEventListener("click", function () {
        URL.revokeObjectURL(u.previewURL);
        pendingUploads.splice(i, 1);
        renderPhotoGrid(existing);
      });
      cell.appendChild(x);
      grid.appendChild(cell);
    });

    if (!existing.length && !pendingUploads.length) {
      grid.appendChild(el("p", { class: "empty-note" }, "No photos yet. Drop some below."));
    }
  }

  // Resize selected files into staged uploads.
  function stageFiles(fileList, existing) {
    var files = Array.prototype.slice.call(fileList);
    if (!files.length) return;
    var jobs = files.map(function (file) {
      return processImage(file)
        .then(function (out) {
          var taken = takenNames(existing);
          var name = uniqueName(out.base, ".webp", taken);
          pendingUploads.push({
            blob: out.blob,
            filename: name,
            path: "assets/img/canoes/" + state.year + "/" + name,
            previewURL: URL.createObjectURL(out.blob),
          });
        })
        .catch(function (err) { toast(err.message, "err"); });
    });
    Promise.all(jobs).then(function () { renderPhotoGrid(existing); });
  }

  function wireDropzone(existing) {
    var dz = $("#dropzone");
    var input = $("#fileInput");
    dz.addEventListener("click", function () { input.click(); });
    input.addEventListener("change", function () { stageFiles(input.files, existing); input.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("drag"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove("drag"); });
    });
    dz.addEventListener("drop", function (e) {
      if (e.dataTransfer && e.dataTransfer.files) stageFiles(e.dataTransfer.files, existing);
    });
  }

  function editorMarkup(canoe, isNew) {
    return '' +
      '<div class="editor-head">' +
      '<h2>' + (isNew ? "New year" : esc(canoe.year) + " &middot; " + esc(canoe.name || "Untitled")) + "</h2>" +
      '<span class="sub">' + (isNew ? "Add a canoe and its photos" : "Edit text and photos") + "</span>" +
      "</div>" +

      '<div class="field"' + (isNew ? "" : ' hidden') + '>' +
      '<label for="fYear">Year (4 digits)</label>' +
      '<input type="number" id="fYear" placeholder="2027" value="' + (isNew ? "" : esc(canoe.year)) + '">' +
      "</div>" +

      '<div class="field">' +
      '<label for="fName">Canoe name</label>' +
      '<input type="text" id="fName" placeholder="e.g. Chrysalis" value="' + esc(canoe.name || "") + '">' +
      "</div>" +

      '<div class="field">' +
      '<label for="fDesc">Description <span class="muted">(basic HTML like &lt;strong&gt; is allowed)</span></label>' +
      '<textarea id="fDesc" placeholder="A sentence or two about this canoe.">' + esc(canoe.description || "") + "</textarea>" +
      "</div>" +

      '<div class="field">' +
      "<label>Tags</label>" +
      '<div class="tags" id="tagBox"></div>' +
      '<input type="text" id="fTag" placeholder="Type a tag and press Enter">' +
      "</div>" +

      '<div class="section-title">Photos</div>' +
      '<div class="grid" id="photoGrid"></div>' +
      '<div class="dropzone" id="dropzone" style="margin-top:1rem;">' +
      '<i class="fa fa-cloud-upload"></i>' +
      "Drag photos here, or click to choose. They are resized automatically." +
      "</div>" +
      '<input type="file" id="fileInput" accept="image/*" multiple hidden>' +

      '<div class="actions">' +
      '<button class="btn-primary" id="publishBtn" aria-label="Publish changes"><i class="fa fa-check"></i>&nbsp; Publish changes</button>' +
      (isNew ? "" : '<button class="btn-danger" id="deleteYearBtn">Delete this year&hellip;</button>') +
      '<span class="spacer"></span>' +
      '<span class="muted" id="dirtyNote"></span>' +
      "</div>";
  }

  function openYear(year) {
    if (hasStagedChanges() && !confirm("Discard the changes you have not published?")) return;
    state.mode = "existing";
    state.year = Number(year);
    var canoe = findCanoe(year) || { year: year, name: "", description: "", tags: [] };
    mountEditor(canoe, false);
  }

  function openNewYear() {
    if (hasStagedChanges() && !confirm("Discard the changes you have not published?")) return;
    state.mode = "new";
    state.year = null;
    mountEditor({ year: "", name: "", description: "", tags: [] }, true);
  }

  function mountEditor(canoe, isNew) {
    pendingUploads.forEach(function (u) { URL.revokeObjectURL(u.previewURL); });
    pendingUploads = [];
    pendingDeletes = [];
    currentTags = (canoe.tags || []).slice();

    $("#editor").innerHTML = editorMarkup(canoe, isNew);
    renderYearList();
    renderTags();

    // Enter or comma commits a tag.
    var tagInput = $("#fTag");
    tagInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        var v = tagInput.value.trim().replace(/,$/, "");
        if (v && currentTags.indexOf(v) === -1) { currentTags.push(v); renderTags(); }
        tagInput.value = "";
      }
    });

    var existing = [];
    renderPhotoGrid(existing);
    wireDropzone(existing);

    // Load this year's current photos.
    if (!isNew) {
      listYearImages(canoe.year)
        .then(function (imgs) { existing.length = 0; imgs.forEach(function (i) { existing.push(i); }); renderPhotoGrid(existing); })
        .catch(function (e) { toast("Could not list photos: " + e.message, "err"); });
    }

    $("#publishBtn").addEventListener("click", function () { onPublish(existing, isNew); });
    var delBtn = $("#deleteYearBtn");
    if (delBtn) delBtn.addEventListener("click", function () { onDeleteYear(canoe, existing); });
  }

  /* ------------------------------ actions -------------------------------- */

  function onPublish(existing, isNew) {
    var name = $("#fName").value.trim();
    var desc = $("#fDesc").value.trim();
    var yearVal = isNew ? $("#fYear").value.trim() : String(state.year);

    if (isNew) {
      if (!/^\d{4}$/.test(yearVal)) return toast("Enter a 4-digit year.", "err");
      if (findCanoe(yearVal)) return toast("That year already exists. Open it from the list instead.", "err");
      if (!name) return toast("Give the canoe a name.", "err");
      state.year = Number(yearVal);
      // Re-point uploads staged before the year was set.
      pendingUploads.forEach(function (u) {
        u.path = "assets/img/canoes/" + state.year + "/" + u.filename;
      });
    }

    // Build next canoes list and detect text changes.
    var next = state.canoes.slice();
    var existingEntry = findCanoe(yearVal);
    var entry = { year: Number(yearVal), name: name, description: desc, tags: currentTags.slice() };
    var textChanged;
    if (existingEntry) {
      textChanged = JSON.stringify({ name: existingEntry.name || "", description: existingEntry.description || "", tags: existingEntry.tags || [] })
        !== JSON.stringify({ name: name, description: desc, tags: currentTags });
      next = next.map(function (c) { return Number(c.year) === Number(yearVal) ? mergeEntry(c, entry) : c; });
    } else {
      textChanged = true;
      next.push(entry);
      next.sort(function (a, b) { return Number(b.year) - Number(a.year); });
    }

    if (!pendingUploads.length && !pendingDeletes.length && !textChanged) {
      return toast("Nothing to publish yet.", "");
    }

    var parts = [];
    if (pendingUploads.length) parts.push("+" + pendingUploads.length + " photo" + (pendingUploads.length > 1 ? "s" : ""));
    if (pendingDeletes.length) parts.push("-" + pendingDeletes.length + " photo" + (pendingDeletes.length > 1 ? "s" : ""));
    if (textChanged) parts.push("text");
    var message = "Manage " + yearVal + ": " + parts.join(", ");

    var btn = $("#publishBtn");
    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>&nbsp; Publishing…';

    publish({ canoesContent: textChanged ? buildCanoesContent(next) : null, message: message })
      .then(function (sha) {
        var link = "https://github.com/" + REPO.owner + "/" + REPO.name + "/commit/" + sha;
        var note = pendingUploads.length || pendingDeletes.length
          ? "New photos appear on the timeline in about a minute (a rebuild runs first)."
          : "Text changes are live now.";
        toast('Published. <a href="' + link + '" target="_blank" rel="noopener">View commit</a>. ' + note, "ok", { sticky: true });
        return loadCanoes();
      })
      .then(function () {
        clearStaged();
        openYear(state.year);
      })
      .catch(function (err) {
        toast("Publish failed: " + err.message, "err", { sticky: true });
        btn.disabled = false;
        btn.innerHTML = '<i class="fa fa-check"></i>&nbsp; Publish changes';
      });
  }

  function onDeleteYear(canoe, existing) {
    if (!confirm("Delete " + canoe.year + " (\"" + (canoe.name || "") + "\") and all its photos? This cannot be undone from here.")) return;

    // Stage removal of the entry and its images.
    var next = state.canoes.filter(function (c) { return Number(c.year) !== Number(canoe.year); });
    pendingUploads = [];
    pendingDeletes = existing.map(function (f) { return f.path; });

    var message = "Manage " + canoe.year + ": remove year and " + pendingDeletes.length + " photo(s)";
    var btn = $("#deleteYearBtn");
    btn.disabled = true;
    btn.textContent = "Deleting…";

    publish({ canoesContent: buildCanoesContent(next), message: message })
      .then(function (sha) {
        var link = "https://github.com/" + REPO.owner + "/" + REPO.name + "/commit/" + sha;
        toast('Deleted ' + canoe.year + '. <a href="' + link + '" target="_blank" rel="noopener">View commit</a>.', "ok", { sticky: true });
        return loadCanoes();
      })
      .then(function () {
        clearStaged();
        state.year = null;
        state.mode = null;
        renderYearList();
        $("#editor").innerHTML = '<p class="empty-note">Pick a year on the left, or add a new one.</p>';
      })
      .catch(function (err) {
        toast("Delete failed: " + err.message, "err", { sticky: true });
        btn.disabled = false;
        btn.textContent = "Delete this year…";
      });
  }

  /* --------------------------- small utilities --------------------------- */

  function findCanoe(year) {
    return state.canoes.filter(function (c) { return Number(c.year) === Number(year); })[0] || null;
  }
  // Keep unmanaged fields (e.g. an "images" override).
  function mergeEntry(orig, entry) {
    var out = {};
    Object.keys(orig).forEach(function (k) { out[k] = orig[k]; });
    out.name = entry.name; out.description = entry.description; out.tags = entry.tags; out.year = entry.year;
    return out;
  }
  function hasStagedChanges() {
    return pendingUploads.length > 0 || pendingDeletes.length > 0;
  }
  // Drop staged edits and free preview URLs.
  function clearStaged() {
    pendingUploads.forEach(function (u) { URL.revokeObjectURL(u.previewURL); });
    pendingUploads = [];
    pendingDeletes = [];
  }

  /* -------------------------------- auth --------------------------------- */

  function showWorkspace() {
    $("#tokenGate").hidden = true;
    $("#workspace").hidden = false;
    $("#signOut").hidden = false;
    renderYearList();
  }

  function signIn(token) {
    state.token = token;
    var save = $("#tokenSave");
    save.disabled = true;
    $("#tokenError").hidden = true;

    // Verify the token reads the repo first.
    loadCanoes()
      .then(function () { return gh("/user").catch(function () { return null; }); })
      .then(function (user) {
        localStorage.setItem(TOKEN_KEY, token);
        if (user && user.login) { $("#who").textContent = "@" + user.login; $("#who").hidden = false; }
        showWorkspace();
      })
      .catch(function (err) {
        state.token = null;
        var box = $("#tokenError");
        box.textContent = err.message;
        box.hidden = false;
      })
      .then(function () { save.disabled = false; });
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    location.reload();
  }

  /* --------------------------------- init -------------------------------- */

  function init() {
    $("#tokenSave").addEventListener("click", function () {
      var v = $("#tokenInput").value.trim();
      if (v) signIn(v);
    });
    $("#tokenInput").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { var v = e.target.value.trim(); if (v) signIn(v); }
    });
    $("#signOut").addEventListener("click", signOut);
    $("#newYear").addEventListener("click", openNewYear);

    // Warn before losing unpublished changes.
    window.addEventListener("beforeunload", function (e) {
      if (hasStagedChanges()) { e.preventDefault(); e.returnValue = ""; }
    });

    var saved = localStorage.getItem(TOKEN_KEY);
    if (saved) signIn(saved);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
