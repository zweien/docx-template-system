import { NextResponse } from "next/server";

export async function GET() {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cookie Test</title></head>
<body style="font-family:monospace;padding:20px;word-break:break-all">
<h2>Cookie Test Result</h2>
<p><strong>document.cookie:</strong></p>
<pre id="cookies"></pre>
<p><strong>Cookie HTTP header (from server):</strong></p>
<pre id="server"></pre>
<script>
document.getElementById("cookies").textContent = document.cookie || "(empty)";

// Also fetch server-side view
fetch("/api/auth/dingtalk/cookie-check").then(r=>r.text()).then(t=>{
  document.getElementById("server").textContent = t;
}).catch(e=>{
  document.getElementById("server").textContent = "Error: " + e.message;
});
</script>
</body></html>`;
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
