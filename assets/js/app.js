(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const views = {
    normal: { node: $("#normal-view"), title: "Normal extraction" },
    prompt: { node: $("#prompt-view"), title: "Prompt capture" }
  };

  function showToast(message) {
    let toast = $("#toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      toast.className = "toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.append(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function switchView(name) {
    if (!views[name]) return;
    Object.entries(views).forEach(([key, view]) => {
      view.node.classList.toggle("is-active", key === name);
    });
    $$(".nav-link").forEach((button) => {
      const active = button.dataset.view === name;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    $("#crumb-current").textContent = views[name].title;
  }

  $$(".nav-link").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  $$(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.dataset.panel;
      $$(".tab").forEach((tab) => {
        const active = tab === button;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      $$(".panel-view").forEach((panel) => {
        const active = panel.id === selected + "-panel";
        panel.classList.toggle("is-active", active);
        panel.hidden = !active;
      });
    });
  });

  $("#character-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("#character-url");
    const message = $("#url-message");
    let characterUrl;

    try {
      characterUrl = new URL(input.value.trim());
    } catch {
      message.textContent = "Enter a valid Janitor AI character URL.";
      message.classList.add("is-visible");
      input.focus();
      return;
    }

    const validHost = characterUrl.hostname === "janitorai.com" ||
      characterUrl.hostname.endsWith(".janitorai.com");
    const validPath = /\/characters?\//i.test(characterUrl.pathname);

    if (!validHost || !validPath) {
      message.textContent = "Please use a character page link from janitorai.com.";
      message.classList.add("is-visible");
      input.focus();
      return;
    }

    message.classList.remove("is-visible");
    const opened = window.open(characterUrl.href, "_blank", "noopener,noreferrer");
    if (opened) {
      message.textContent = "Character page opened. Browser extraction will be connected in the next development step.";
    } else {
      message.textContent = "Your browser blocked the new tab. Allow pop-ups for this site, then try again.";
    }
    message.classList.add("is-visible");
  });

  $("#help-button").addEventListener("click", () => {
    showToast("This is the first interface version. The Brave connector and API receiver are the next steps.");
  });

  // The endpoint is intentionally display-only until the local API is implemented.
  // Never persist captured prompts, credentials, cookies or chat history in this interface.
  const endpointInput = $("#endpoint-url");
  if (endpointInput) {
    endpointInput.addEventListener("input", () => {
      endpointInput.value = endpointInput.value.replace(/\s/g, "");
    });
  }

  switchView("normal");
})();