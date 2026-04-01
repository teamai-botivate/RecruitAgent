"""
Auth API Router - Gmail OAuth endpoints
Exact same flow as original unified_server.py OAuth routes
"""

import os
from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse, HTMLResponse

from ..services.gmail_oauth import gmail_oauth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/gmail/start")
async def start_gmail_oauth(request: Request, company_id: str = Query(default="default_company")):
    """Start Gmail OAuth flow - redirect user to Google."""
    try:
        base_url_env = os.getenv("BASE_URL") or os.getenv("BASE_URI")
        space_id = os.getenv("SPACE_ID")

        if base_url_env:
            if "localhost" in base_url_env or "127.0.0.1" in base_url_env:
                base_url = base_url_env.rstrip("/")
            else:
                base_url = base_url_env.replace("http://", "https://").rstrip("/")
        elif space_id:
            base_url = f"https://{space_id.replace('/', '-')}.hf.space"
        else:
            host = request.headers.get("x-forwarded-host") or request.headers.get("host") or "localhost:8000"
            if "localhost" in host or "127.0.0.1" in host:
                proto = "http"
            else:
                proto = request.headers.get("x-forwarded-proto", "https")
            base_url = f"{proto}://{host}".rstrip("/")

        redirect_uri = f"{base_url}/auth/gmail/callback"

        auth_url, state = gmail_oauth_service.get_authorization_url(company_id, redirect_uri)
        return RedirectResponse(url=auth_url)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start OAuth: {str(e)}")


@router.get("/gmail/callback")
async def gmail_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    company_id: str = Query(default="default_company"),
):
    """Handle OAuth callback from Google."""
    try:
        result = gmail_oauth_service.handle_callback(company_id, code, state)
        user_email = result.get("email", "")

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Gmail Connected</title>
            <style>
                body {{
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }}
                .container {{
                    background: white;
                    padding: 40px;
                    border-radius: 15px;
                    box-shadow: 0 15px 35px rgba(0,0,0,0.2);
                    text-align: center;
                    max-width: 400px;
                    width: 90%;
                }}
                .success-icon {{ font-size: 80px; margin-bottom: 20px; }}
                h1 {{ color: #333; margin: 0 0 10px; }}
                p {{ color: #666; margin: 10px 0; line-height: 1.5; }}
                .email {{
                    background: #f0f2f5;
                    padding: 12px;
                    border-radius: 8px;
                    margin: 20px 0;
                    color: #444;
                    font-weight: 600;
                }}
                .btn {{
                    display: inline-block;
                    margin-top: 15px;
                    padding: 12px 30px;
                    background: #4f46e5;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-weight: bold;
                    cursor: pointer;
                    font-size: 16px;
                }}
                .btn:hover {{ background: #4338ca; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="success-icon">✅</div>
                <h1>Connection Established</h1>
                <p>Gmail has been successfully synced with RecruitAI.</p>
                <div class="email">{user_email}</div>
                <p style="font-size: 0.9em; opacity: 0.8;">This window will close automatically.</p>
                <button onclick="closeAndReturn()" class="btn">Return to Dashboard</button>
            </div>

            <script>
                function closeAndReturn() {{
                    const connectionData = {{
                        type: 'gmail_connected',
                        email: '{user_email}',
                        timestamp: Date.now()
                    }};
                    try {{
                        if (window.opener) window.opener.postMessage(connectionData, '*');
                        const bc = new BroadcastChannel('gmail_auth');
                        bc.postMessage(connectionData);
                        localStorage.setItem('gmail_connected_signal', JSON.stringify(connectionData));
                    }} catch (e) {{}}
                    setTimeout(() => {{ window.close(); }}, 500);
                    setTimeout(() => {{ window.location.href = "/"; }}, 2000);
                }}
                setTimeout(closeAndReturn, 2500);
            </script>
        </body>
        </html>
        """
        return HTMLResponse(content=html_content)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth callback failed: {str(e)}")


@router.get("/gmail/status")
async def gmail_connection_status(response: Response, company_id: str = Query(default="default_company")):
    """Check Gmail connection status."""
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    try:
        is_connected = gmail_oauth_service.is_connected(company_id)
        email = None

        if is_connected:
            try:
                credentials = gmail_oauth_service.get_credentials(company_id)
                from googleapiclient.discovery import build
                service = build("gmail", "v1", credentials=credentials)
                profile = service.users().getProfile(userId="me").execute()
                email = profile.get("emailAddress")
            except Exception:
                is_connected = False

        return {"connected": is_connected, "email": email}
    except Exception as e:
        return {"connected": False, "email": None, "error": str(e)}


@router.post("/gmail/disconnect")
async def disconnect_gmail(company_id: str = Query(default="default_company")):
    """Disconnect Gmail and revoke access."""
    try:
        gmail_oauth_service.revoke_access(company_id)
        return {"status": "success", "message": "Gmail disconnected successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to disconnect: {str(e)}")
