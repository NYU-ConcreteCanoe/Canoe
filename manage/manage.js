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
  function processImage(file, maxDim) {
    maxDim = maxDim || MAX_DIM;
    return new Promise(function (resolve, reject) {
      if (!/^image\//.test(file.type)) return reject(new Error("Not an image: " + file.name));
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth, h = img.naturalHeight;
        if (w > maxDim || h > maxDim) {
          var s = Math.min(maxDim / w, maxDim / h);
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

  // opts: { uploads: [{blob, path}], deletes: [path], files: [{path, content}], message }
  function publish(opts) {
    var o = REPO.owner, r = REPO.name, b = REPO.branch;
    var base = "/repos/" + o + "/" + r;
    var latestCommitSha, baseTreeSha;
    var uploads = opts.uploads || [];
    var deletes = opts.deletes || [];
    var files = opts.files || [];

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
        uploads.forEach(function (up) {
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
        deletes.forEach(function (p) {
          tree.push({ path: p, mode: "100644", type: "blob", sha: null });
        });
        // Inline updated JSON data files.
        files.forEach(function (f) {
          tree.push({ path: f.path, mode: "100644", type: "blob", content: f.content });
        });
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

    publish({
      uploads: pendingUploads,
      deletes: pendingDeletes,
      files: textChanged ? [{ path: "assets/data/canoes.json", content: buildCanoesContent(next) }] : [],
      message: message,
    })
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

    publish({
      uploads: [],
      deletes: pendingDeletes,
      files: [{ path: "assets/data/canoes.json", content: buildCanoesContent(next) }],
      message: message,
    })
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

  /* ===================== leadership editor (About us) ==================== */

  var HEADSHOT_DIR = "assets/img/headshots/";
  var HEADSHOT_MAX = 900; // headshots render small; no need for full size
  var PLACEHOLDER = HEADSHOT_DIR + "placeholder.jpeg";

  var team = {
    doc: null, // full parsed team.json
    faculty: [], // working copies
    leadership: [],
    shots: [], // existing files in the headshots folder
    loaded: false,
    dragFrom: null, // {list, index} while dragging
  };

  function loadTeam() {
    return gh("/repos/" + REPO.owner + "/" + REPO.name + "/contents/assets/data/team.json?ref=" + REPO.branch)
      .then(function (data) {
        team.doc = JSON.parse(decodeBase64Utf8(data.content));
        team.faculty = toWorking(team.doc.faculty);
        team.leadership = toWorking(team.doc.leadership);
      })
      .then(listHeadshots)
      .then(function (shots) {
        team.shots = shots;
        team.loaded = true;
      });
  }

  function listHeadshots() {
    return gh("/repos/" + REPO.owner + "/" + REPO.name + "/contents/assets/img/headshots?ref=" + REPO.branch)
      .then(function (items) {
        return (items || [])
          .filter(function (it) { return it.type === "file" && IMAGE_RE.test(it.name); })
          .map(function (it) { return { name: it.name, path: it.path, url: it.download_url }; });
      })
      .catch(function (e) {
        if (e.status === 404) return []; // folder not created yet
        throw e;
      });
  }

  // Editable copy; `_orig` keeps any fields this tool does not manage.
  function toWorking(list) {
    return (Array.isArray(list) ? list : []).map(function (p) {
      return {
        name: p.name || "",
        role: p.role || "",
        email: p.email || "",
        image: p.image || "",
        _orig: p,
        _upload: null, // staged replacement headshot
      };
    });
  }

  // Merge back, preserving unmanaged keys.
  function personOut(p, withEmail) {
    var out = {};
    if (p._orig) Object.keys(p._orig).forEach(function (k) { out[k] = p._orig[k]; });
    out.name = p.name;
    out.role = p.role;
    out.image = p.image;
    if (withEmail) out.email = p.email; else delete out.email;
    delete out._upload;
    delete out._orig;
    return out;
  }

  function buildTeamContent() {
    var doc = {};
    Object.keys(team.doc).forEach(function (k) {
      if (k === "faculty") doc[k] = team.faculty.map(function (p) { return personOut(p, true); });
      else if (k === "leadership") doc[k] = team.leadership.map(function (p) { return personOut(p, false); });
      else doc[k] = team.doc[k];
    });
    if (!("faculty" in doc)) doc.faculty = team.faculty.map(function (p) { return personOut(p, true); });
    if (!("leadership" in doc)) doc.leadership = team.leadership.map(function (p) { return personOut(p, false); });
    return JSON.stringify(doc, null, 2) + "\n";
  }

  // "Janice Chen" -> "janiceC", matching the existing headshot naming.
  function headshotBase(name) {
    var parts = String(name || "").trim().split(/\s+/);
    var first = (parts[0] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    var initial = parts.length > 1 ? String(parts[parts.length - 1]).charAt(0).toUpperCase().replace(/[^A-Z]/g, "") : "";
    return (first || "person") + initial;
  }

  function everyone() { return team.faculty.concat(team.leadership); }

  function teamDirty() {
    if (!team.loaded) return false;
    var origFaculty = JSON.stringify((team.doc.faculty || []).map(function (p) { return { n: p.name || "", r: p.role || "", e: p.email || "", i: p.image || "" }; }));
    var origLead = JSON.stringify((team.doc.leadership || []).map(function (p) { return { n: p.name || "", r: p.role || "", i: p.image || "" }; }));
    var nowFaculty = JSON.stringify(team.faculty.map(function (p) { return { n: p.name, r: p.role, e: p.email, i: p.image }; }));
    var nowLead = JSON.stringify(team.leadership.map(function (p) { return { n: p.name, r: p.role, i: p.image }; }));
    var staged = everyone().some(function (p) { return !!p._upload; });
    return staged || origFaculty !== nowFaculty || origLead !== nowLead;
  }

  /* ---------------------------- team rendering --------------------------- */

  function personPreview(p) {
    if (p._upload) return p._upload.previewURL;
    if (!p.image) return "../" + PLACEHOLDER;
    var hit = team.shots.filter(function (s) { return s.path === p.image; })[0];
    if (hit) return hit.url;
    // Outside the headshots folder (or brand new) — resolve relative to the repo root.
    return "../" + p.image;
  }

  function renderPersonRow(p, list, listName, index) {
    var row = el("div", { class: "person", draggable: "true" });

    row.appendChild(el("span", { class: "handle", title: "Drag to reorder", "aria-hidden": "true" }, '<i class="fa fa-bars"></i>'));

    // Photo + replace button
    var shot = el("div", { class: "shot" });
    shot.appendChild(el("img", { src: personPreview(p), alt: "", loading: "lazy" }));
    var pick = el("button", { class: "btn-sm", type: "button" }, p._upload ? "Change" : "Replace");
    var fileIn = el("input", { type: "file", accept: "image/*", hidden: "hidden" });
    pick.addEventListener("click", function () { fileIn.click(); });
    fileIn.addEventListener("change", function () {
      var f = fileIn.files && fileIn.files[0];
      fileIn.value = "";
      if (!f) return;
      processImage(f, HEADSHOT_MAX)
        .then(function (out) {
          if (p._upload) URL.revokeObjectURL(p._upload.previewURL);
          p._upload = { blob: out.blob, previewURL: URL.createObjectURL(out.blob) };
          renderTeam();
        })
        .catch(function (err) { toast(err.message, "err"); });
    });
    shot.appendChild(pick);
    shot.appendChild(fileIn);
    if (p._upload) shot.appendChild(el("div", { class: "new-badge" }, "New photo"));
    row.appendChild(shot);

    // Name / role / email
    var fields = el("div", { class: "fields" });
    var nameIn = el("input", { type: "text", placeholder: "Full name", value: p.name });
    nameIn.value = p.name;
    nameIn.addEventListener("input", function () { p.name = nameIn.value; });
    fields.appendChild(nameIn);

    var roleIn = el("input", { type: "text", placeholder: "Role (e.g. Team Captain)" });
    roleIn.value = p.role;
    roleIn.addEventListener("input", function () { p.role = roleIn.value; });
    fields.appendChild(roleIn);

    if (listName === "faculty") {
      var mailIn = el("input", { type: "text", placeholder: "Email (optional)" });
      mailIn.value = p.email;
      mailIn.addEventListener("input", function () { p.email = mailIn.value; });
      fields.appendChild(mailIn);
    }
    row.appendChild(fields);

    // Move / remove
    var actions = el("div", { class: "row-actions" });
    var up = el("button", { class: "btn-sm", type: "button", title: "Move up", "aria-label": "Move up" }, '<i class="fa fa-arrow-up"></i>');
    up.disabled = index === 0;
    up.addEventListener("click", function () { movePerson(list, index, index - 1); });
    var down = el("button", { class: "btn-sm", type: "button", title: "Move down", "aria-label": "Move down" }, '<i class="fa fa-arrow-down"></i>');
    down.disabled = index === list.length - 1;
    down.addEventListener("click", function () { movePerson(list, index, index + 1); });
    var rm = el("button", { class: "btn-sm btn-danger", type: "button", title: "Remove", "aria-label": "Remove" }, '<i class="fa fa-trash"></i>');
    rm.addEventListener("click", function () {
      if (!confirm("Remove " + (p.name || "this person") + " from the page?")) return;
      if (p._upload) URL.revokeObjectURL(p._upload.previewURL);
      list.splice(index, 1);
      renderTeam();
    });
    actions.appendChild(up); actions.appendChild(down); actions.appendChild(rm);
    row.appendChild(actions);

    // Drag to reorder (within one list only).
    row.addEventListener("dragstart", function (e) {
      team.dragFrom = { list: listName, index: index };
      row.classList.add("dragging");
      if (e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(index)); }
    });
    row.addEventListener("dragend", function () {
      team.dragFrom = null;
      row.classList.remove("dragging");
    });
    row.addEventListener("dragover", function (e) {
      if (!team.dragFrom || team.dragFrom.list !== listName) return;
      e.preventDefault();
      row.classList.add("drop-target");
    });
    row.addEventListener("dragleave", function () { row.classList.remove("drop-target"); });
    row.addEventListener("drop", function (e) {
      row.classList.remove("drop-target");
      if (!team.dragFrom || team.dragFrom.list !== listName) return;
      e.preventDefault();
      movePerson(list, team.dragFrom.index, index);
    });

    return row;
  }

  function movePerson(list, from, to) {
    if (to < 0 || to >= list.length || from === to) return;
    var item = list.splice(from, 1)[0];
    list.splice(to, 0, item);
    renderTeam();
  }

  function renderTeam() {
    var box = $("#teamEditor");
    box.innerHTML = '' +
      '<div class="editor-head">' +
      "<h2>About us &middot; Leadership</h2>" +
      '<span class="sub">Names, roles and headshots on the About page</span>' +
      "</div>" +
      '<div class="section-title">Faculty advisor</div><div id="facultyList"></div>' +
      '<button class="btn-sm" id="addFaculty" type="button"><i class="fa fa-plus"></i>&nbsp; Add faculty advisor</button>' +
      '<div class="section-title">Student leadership</div><div id="leadershipList"></div>' +
      '<button class="btn-sm" id="addPerson" type="button"><i class="fa fa-plus"></i>&nbsp; Add person</button>' +
      '<div class="actions">' +
      '<button class="btn-primary" id="publishTeam" type="button"><i class="fa fa-check"></i>&nbsp; Publish changes</button>' +
      '<span class="spacer"></span>' +
      '<span class="muted">Drag the handle, or use the arrows, to reorder.</span>' +
      "</div>";

    var fl = $("#facultyList");
    team.faculty.forEach(function (p, i) { fl.appendChild(renderPersonRow(p, team.faculty, "faculty", i)); });
    if (!team.faculty.length) fl.appendChild(el("p", { class: "empty-note" }, "No faculty advisor listed."));

    var ll = $("#leadershipList");
    team.leadership.forEach(function (p, i) { ll.appendChild(renderPersonRow(p, team.leadership, "leadership", i)); });
    if (!team.leadership.length) ll.appendChild(el("p", { class: "empty-note" }, "Nobody yet. Add the first person below."));

    $("#addFaculty").addEventListener("click", function () {
      team.faculty.push({ name: "", role: "Faculty Advisor", email: "", image: "", _orig: null, _upload: null });
      renderTeam();
    });
    $("#addPerson").addEventListener("click", function () {
      team.leadership.push({ name: "", role: "", email: "", image: "", _orig: null, _upload: null });
      renderTeam();
    });
    $("#publishTeam").addEventListener("click", onPublishTeam);
  }

  /* ----------------------------- team publish ---------------------------- */

  function onPublishTeam() {
    var people = everyone();

    var blank = people.filter(function (p) { return !p.name.trim(); }).length;
    if (blank) return toast("Every person needs a name (" + blank + " still blank).", "err");
    if (!teamDirty()) return toast("Nothing to publish yet.", "");

    // Name staged headshots, avoiding collisions with existing and staged files.
    var taken = {};
    team.shots.forEach(function (s) { taken[s.name.toLowerCase()] = true; });

    var uploads = [];
    var replaced = []; // headshots that are no longer referenced
    people.forEach(function (p) {
      if (!p._upload) return;
      var name = uniqueName(headshotBase(p.name), ".webp", taken);
      taken[name.toLowerCase()] = true;
      var path = HEADSHOT_DIR + name;
      uploads.push({ blob: p._upload.blob, path: path });
      if (p.image) replaced.push(p.image);
      p.image = path;
    });

    // Headshots belonging to people who were removed.
    var stillUsed = {};
    people.forEach(function (p) { if (p.image) stillUsed[p.image] = true; });
    (team.doc.faculty || []).concat(team.doc.leadership || []).forEach(function (p) {
      if (p.image) replaced.push(p.image);
    });

    var deletes = [];
    replaced.forEach(function (path) {
      if (!path || stillUsed[path]) return; // still referenced somewhere
      if (path === PLACEHOLDER) return; // never delete the placeholder
      if (path.indexOf(HEADSHOT_DIR) !== 0) return; // only prune the headshots folder
      if (!team.shots.some(function (s) { return s.path === path; })) return; // not a real file
      if (deletes.indexOf(path) === -1) deletes.push(path);
    });

    var parts = [];
    if (uploads.length) parts.push("+" + uploads.length + " headshot" + (uploads.length > 1 ? "s" : ""));
    if (deletes.length) parts.push("-" + deletes.length + " headshot" + (deletes.length > 1 ? "s" : ""));
    parts.push("text");
    var message = "Manage leadership: " + parts.join(", ");

    var btn = $("#publishTeam");
    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>&nbsp; Publishing…';

    publish({
      uploads: uploads,
      deletes: deletes,
      files: [{ path: "assets/data/team.json", content: buildTeamContent() }],
      message: message,
    })
      .then(function (sha) {
        var link = "https://github.com/" + REPO.owner + "/" + REPO.name + "/commit/" + sha;
        toast('Published. <a href="' + link + '" target="_blank" rel="noopener">View commit</a>. The About page updates in about a minute.', "ok", { sticky: true });
        people.forEach(function (p) { if (p._upload) { URL.revokeObjectURL(p._upload.previewURL); p._upload = null; } });
        team.loaded = false;
        return loadTeam();
      })
      .then(renderTeam)
      .catch(function (err) {
        toast("Publish failed: " + err.message, "err", { sticky: true });
        btn.disabled = false;
        btn.innerHTML = '<i class="fa fa-check"></i>&nbsp; Publish changes';
      });
  }

  /* ------------------------------- views --------------------------------- */

  function showView(name) {
    var isTeam = name === "leadership";
    $("#workspace").hidden = isTeam;
    $("#teamWorkspace").hidden = !isTeam;
    $("#tabTimeline").classList.toggle("active", !isTeam);
    $("#tabLeadership").classList.toggle("active", isTeam);

    if (isTeam && !team.loaded) {
      $("#teamEditor").innerHTML = '<p class="empty-note">Loading…</p>';
      loadTeam()
        .then(renderTeam)
        .catch(function (e) {
          $("#teamEditor").innerHTML = '<p class="empty-note">Could not load the team: ' + esc(e.message) + "</p>";
        });
    }
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
    $("#viewTabs").hidden = false;
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
    $("#tabTimeline").addEventListener("click", function () { showView("timeline"); });
    $("#tabLeadership").addEventListener("click", function () { showView("leadership"); });

    // Warn before losing unpublished changes.
    window.addEventListener("beforeunload", function (e) {
      if (hasStagedChanges() || teamDirty()) { e.preventDefault(); e.returnValue = ""; }
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
