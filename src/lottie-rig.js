import lottie from "lottie-web";
// import lottie_api from "lottie-api";

(function() {
  const tmpl = document.createElement("template");
  tmpl.innerHTML = `<div><div id="status"></div></div>
  <style lang="css">
      :host {
          display: block;
          position: relative;
      }
      :host[hidden] {
          display: none;
      }
      #status {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(128, 128, 128, 0.1);
        display: flex;
        flex-direction: column;
        font-family: sans-serif;
        font-size: 14px;
        color: #999;
        align-items: center;
        justify-content: center;
      }
      #status:empty {
        display: none;
      }
      #status span {
        display: block;
        margin-bottom: 5px;
      }
      #status span:last-child {
        color: green;
        font-size: 16px;
      }
      #status span.error {
        color: red;
      }
  </style>
  `;

  class LottieRig extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({
        mode: "open"
      });
      this.shadowRoot.appendChild(tmpl.content.cloneNode(true));
      this._status("Initializing...");
    }

    connectedCallback() {
      const src = this.getAttribute("src");

      const elem = document.createElement("div");
      elem.id = "lottie";
      elem.style.width = this.style.width;
      elem.style.height = this.style.height;

      this._status("Loading animation...");

      this.lottie = lottie.loadAnimation({
        container: elem,
        renderer: "svg",
        loop: true,
        autoplay: true,
        rendererSettings: {
          progressiveLoad: true,
          preserveAspectRatio: "xMidYMid meet",
          imagePreserveAspectRatio: "xMidYMid meet"
        },
        path: src
      });
      this.lottie.setSubframe(false);

      this.lottie.addEventListener("data_failed", () => {
        this._status("Animation load failed!", true);
      });

      this.lottie.addEventListener("DOMLoaded", () => {
        this._status("Hooking up rigs...");
        this.api = lottie_api.createAnimationApi(this.lottie);

        try {
          this.keyPaths.forEach(keyPathName => {
            const keyPath = this.api.getKeyPath(
              `#${keyPathName},Transform,Position`
            );

            this.api.addValueCallback(keyPath, current => {
              return this.api.toContainerPoint(
                this.keyPathValue(keyPathName, current)
              );
            });
          });
        } catch (e) {
          this._status(
            "Error occured while processing key paths and value callback.",
            true
          );
        }

        this._status("");
        this.shadowRoot.firstChild.appendChild(elem);
      });
    }

    disconnectedCallback() {
      this.lottie.destroy();
    }

    _status(msg, isError) {
      if (msg) {
        const msgElem = document.createElement("span");
        msgElem.innerText = msg;
        msgElem.className = isError ? "error" : "";
        this.shadowRoot.querySelector("#status").appendChild(msgElem);
      } else {
        this.shadowRoot.querySelector("#status").innerHTML = "";
      }
    }

    get keyPaths() {
      let keyPathNames = this.getAttribute("key-paths");
      try {
        keyPathNames = JSON.parse(keyPathNames);
      } catch (err) {
        this._status("Unable to parse key paths config...", true);
        keyPathNames = [];
      }

      if (!Array.isArray(keyPathNames)) {
        keyPathNames = [keyPathNames];
      }

      return keyPathNames;
    }

    set keyPaths(keyPathNames) {
      this.setAttribute("key-paths", JSON.stringify(keyPathNames));
    }

    get keyPathValue() {
      return eval(this.getAttribute("key-path-value"));
    }

    set keyPathValue(callback) {
      this.setAttribute("key-path-value", callback);
    }
  }

  window.customElements.define("lottie-rig", LottieRig);
})();
