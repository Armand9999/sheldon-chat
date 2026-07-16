import { createHmac } from "crypto";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  NotAuthorizedException,
  UserNotConfirmedException,
  UserNotFoundException,
} from "@aws-sdk/client-cognito-identity-provider";

function getRegion(): string {
  return process.env.NEXT_PUBLIC_AWS_REGION ?? "us-east-1";
}

function getClientId(): string {
  return process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";
}

function getClientSecret(): string {
  return process.env.COGNITO_CLIENT_SECRET ?? "";
}

const client = new CognitoIdentityProviderClient({ region: getRegion() });

export function cognitoSecretHash(username: string): string {
  const clientSecret = getClientSecret();
  const clientId = getClientId();
  if (!clientSecret) {
    throw new Error("COGNITO_CLIENT_SECRET is not configured");
  }
  if (!clientId) {
    throw new Error("NEXT_PUBLIC_COGNITO_CLIENT_ID is not configured");
  }
  return createHmac("sha256", clientSecret)
    .update(`${username}${clientId}`)
    .digest("base64");
}

export type AuthTokens = {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export async function signInWithPassword(
  username: string,
  password: string,
): Promise<AuthTokens> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error("NEXT_PUBLIC_COGNITO_CLIENT_ID is not configured");
  }

  // App clients with a secret always require SECRET_HASH.
  const authParameters: Record<string, string> = {
    USERNAME: username,
    PASSWORD: password,
    SECRET_HASH: cognitoSecretHash(username),
  };

  try {
    const result = await client.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: clientId,
        AuthParameters: authParameters,
      }),
    );

    const auth = result.AuthenticationResult;
    if (!auth?.IdToken || !auth.AccessToken || !auth.RefreshToken) {
      throw new Error("Cognito did not return tokens.");
    }

    return {
      idToken: auth.IdToken,
      accessToken: auth.AccessToken,
      refreshToken: auth.RefreshToken,
      expiresIn: auth.ExpiresIn ?? 3600,
    };
  } catch (err) {
    if (err instanceof NotAuthorizedException) {
      throw Object.assign(new Error(err.message || "Not authorized"), {
        code: "NotAuthorizedException",
      });
    }
    if (err instanceof UserNotConfirmedException) {
      throw Object.assign(new Error(err.message || "User not confirmed"), {
        code: "UserNotConfirmedException",
      });
    }
    if (err instanceof UserNotFoundException) {
      throw Object.assign(new Error(err.message || "User not found"), {
        code: "UserNotFoundException",
      });
    }
    throw err;
  }
}

export async function refreshTokens(refreshToken: string, username: string): Promise<AuthTokens> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error("NEXT_PUBLIC_COGNITO_CLIENT_ID is not configured");
  }

  const authParameters: Record<string, string> = {
    REFRESH_TOKEN: refreshToken,
    SECRET_HASH: cognitoSecretHash(username),
  };

  const result = await client.send(
    new InitiateAuthCommand({
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: clientId,
      AuthParameters: authParameters,
    }),
  );

  const auth = result.AuthenticationResult;
  if (!auth?.IdToken || !auth.AccessToken) {
    throw new Error("Cognito did not return refreshed tokens.");
  }

  return {
    idToken: auth.IdToken,
    accessToken: auth.AccessToken,
    refreshToken: refreshToken,
    expiresIn: auth.ExpiresIn ?? 3600,
  };
}
