import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/google/callback`
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    // Return the tokens as a nice JSON string that can be copied directly
    return new NextResponse(
      `
      <html>
        <head>
          <title>Google OAuth Tokens</title>
          <style>
            body { font-family: sans-serif; padding: 40px; line-height: 1.6; background: #f8fafc; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 24px; shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
            pre { background: #1e293b; color: #f8fafc; padding: 20px; border-radius: 12px; overflow-x: auto; }
            code { font-family: monospace; }
            h1 { color: #0f172a; }
            .hint { background: #eff6ff; color: #1D4ED8; padding: 15px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #3b82f6; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Authorization Successful!</h1>
            <div class="hint">
              <strong>Action Required:</strong> Copy the JSON below and paste it into your <code>.env.local</code> file as the value for <code>GOOGLE_OAUTH_TOKENS</code>.
            </div>
            <pre><code>GOOGLE_OAUTH_TOKENS='${JSON.stringify(tokens)}'</code></pre>
            <p>Once updated, your application will be fully connected to your Google Sheet backend.</p>
          </div>
        </body>
      </html>
      `,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (error) {
    console.error("Error exchanging code for tokens:", error);
    return NextResponse.json({ error: "Failed to exchange code for tokens" }, { status: 500 });
  }
}
