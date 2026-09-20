from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .jwt_handler import verify_token, TokenData

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> TokenData:
    """
    Dependency to get the current authenticated user from JWT
    
    Usage:
        @app.get("/protected")
        async def protected_route(current_user: TokenData = Depends(get_current_user)):
            return {"user_id": current_user.user_id}
    """
    token = credentials.credentials
    return await verify_token(token, expected_type="access")


def require_role(required_roles: list[str]):
    """
    Dependency factory for role-based access control
    
    Usage:
        @app.get("/admin")
        async def admin_route(
            current_user: TokenData = Depends(require_role(["SuperAdmin", "OrgAdmin"]))
        ):
            return {"user": current_user.user_id}
    """
    async def role_checker(
        current_user: TokenData = Depends(get_current_user),
    ) -> TokenData:
        if not any(role in current_user.roles for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {required_roles}",
            )
        return current_user
    
    return role_checker


# Common role dependencies
require_admin = require_role(["SuperAdmin", "OrgAdmin"])
require_auditor = require_role(["SuperAdmin", "OrgAdmin", "Auditor"])
require_agent_builder = require_role(["SuperAdmin", "OrgAdmin", "AgentBuilder"])
