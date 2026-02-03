document.addEventListener("DOMContentLoaded", () => {
  const jobElement = document.querySelector(".job-status[data-job-id]");
  if (jobElement && jobElement.dataset.jobId) {
    pollJob(jobElement);
  }
});

function pollJob(jobElement) {
  const jobId = jobElement.dataset.jobId;
  const jobUrl = jobElement.dataset.jobUrl;
  const transcriptUrl = jobElement.dataset.transcriptUrl;
  const messageEl = jobElement.querySelector("[data-job-message]");
  const progressEl = jobElement.querySelector("[data-job-progress]");

  if (!jobUrl) {
    return;
  }

  const interval = setInterval(async () => {
    try {
      const response = await fetch(jobUrl);
      if (!response.ok) {
        clearInterval(interval);
        if (messageEl) {
          messageEl.textContent = "Error checking job status";
        }
        return;
      }
      const data = await response.json();
      if (messageEl) {
        messageEl.textContent = data.message || `Status: ${data.status}`;
      }
      if (progressEl) {
        const progress = Number.isFinite(data.progress) ? data.progress : 0;
        progressEl.style.width = `${Math.min(Math.max(progress, 0), 100)}%`;
      }
      if (data.status === "success" || data.status === "error") {
        clearInterval(interval);
        if (data.status === "success" && transcriptUrl) {
          await refreshTranscript(transcriptUrl);
        }
      }
    } catch (error) {
      clearInterval(interval);
    }
  }, 2000);
}

async function refreshTranscript(url) {
  const response = await fetch(url);
  if (!response.ok) {
    return;
  }
  const data = await response.json();
  const panel = document.getElementById("transcriptPanel");
  if (panel && data.html) {
    panel.innerHTML = data.html;
  }
}
