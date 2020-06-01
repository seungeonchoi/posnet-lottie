import * as posenet from "@tensorflow-models/posenet";

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

  const defaultPosenetConfig = {
    architecture: "ResNet50",
    outputStride: 32,
    inputResolution: 161,
    quantBytes: 2
  };

  const defaultPoseInferenceConfig = {
    flipHorizontal: false,
    maxDetections: 1,
    scoreThreshold: 0.5,
    nmsRadius: 20
  };

  class PoseDetect extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({
        mode: "open"
      });
      this.shadowRoot.appendChild(tmpl.content.cloneNode(true));
      this._status("Initializing...");
    }

    _drawKeypoints(keypoints, minConfidence, skeletonColor, ctx, scale = 1) {
      keypoints.forEach(keypoint => {
        if (keypoint.score >= minConfidence) {
          const { y, x } = keypoint.position;
          ctx.beginPath();
          ctx.arc(x * scale, y * scale, 3, 0, 2 * Math.PI);
          ctx.fillStyle = skeletonColor;
          ctx.fill();
        }
      });
    }

    async _setupCamera(preview) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // console.log("no media device");
        throw Error(
          "Browser API navigator.mediaDevices.getUserMedia not available"
        );
      }

      const isMobile =
        /Android/i.test(navigator.userAgent) ||
        /iPhone|iPad|iPod/i.test(navigator.userAgent);

      preview.srcObject = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: isMobile ? 0 : 500,
          height: isMobile ? 0 : 400
        }
      });

      return new Promise(resolve => {
        preview.onloadedmetadata = () => {
          preview.play();
          resolve();
        };
      });
    }

    async _setupVideo(preview, url) {
      preview.src = url;

      return new Promise(resolve => {
        preview.onloadedmetadata = () => {
          preview.play();
          resolve();
        };
      });
    }

    async _setupPoseNet(config) {
      return await posenet.load(config);
    }

    async connectedCallback() {
      // Create canvas
      this._status("Creating canvas...");
      const canvas = document.createElement("canvas");
      canvas.width = 500;
      canvas.height = 400;
      this.shadowRoot.firstChild.appendChild(canvas);

      // Create video
      this._status("Creating preview container...");
      const preview = document.createElement("video");
      preview.style.display = "none";
      preview.width = 500;
      preview.height = 400;
      this.shadowRoot.firstChild.appendChild(preview);

      if (this.hasAttribute("camera")) {
        // Hookup camera to the preview...
        this._status("Hooking up camera...");
        await this._setupCamera(preview);
      } else if (this.getAttribute("video")) {
        // Hookup video  file to the preview...
        this._status("Loading video file...");
        await this._setupVideo(preview, this.getAttribute("video"));
      } else {
        this._status("No pose source specified!");
        return;
      }

      // Load PoseNet
      this._status("Loading PoseNet (may take a while)...");
      const net = await this._setupPoseNet({
        ...this.posenetConfig,
        ...defaultPosenetConfig
      });

      const inferenceConfig = {
        ...this.poseInferenceConfig,
        ...defaultPoseInferenceConfig
      };

      const ctx = canvas.getContext("2d");

      const run = async () => {
        const poses = await net.estimateMultiplePoses(preview, inferenceConfig);

        this.dispatchEvent(new CustomEvent("onpose", { detail: poses }));

        if (!this.hasAttribute("hide-keypoints")) {
          ctx.drawImage(preview, 0, 0, canvas.width, canvas.height);
        }

        if (!this.hasAttribute("hide-keypoints")) {
          poses.forEach(pose => {
            this._drawKeypoints(pose.keypoints, 0.5, "red", ctx);
          });
        }

        requestAnimationFrame(run);
      };

      this._status("");

      run();
    }

    get posenetConfig() {
      try {
        return JSON.parse(this.getAttribute("posenet-config"));
      } catch (err) {
        return {};
      }
    }

    set posenetConfig(config) {
      this.setAttribute("posenet-config", JSON.stringify(config));
    }

    get poseInferenceConfig() {
      try {
        return JSON.parse(this.getAttribute("inference-config"));
      } catch (err) {
        return {};
      }
    }

    set poseInferenceConfig(config) {
      this.setAttribute("inference-config", JSON.stringify(config));
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
  }

  window.customElements.define("pose-detect", PoseDetect);
})();
