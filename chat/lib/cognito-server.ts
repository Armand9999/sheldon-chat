import { createHmac } from "crypto";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  NotAuthorizedException,
  UserNotConfirmedException,
  UserNotFoundException,
} from "@aws-sdk/client-cognito-identity-provider";

const REGION = process.env.NEXT_PUBLIC_AWS_REGION ?? "us-east-1";
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET ?? "";

const client = new CognitoIdentityProviderClient({ region: REGION });

export function cognitoSecretHash(username: string): string {
  if (!CLIENT_SECRET) {
    throw new Error("COGNITO_CLIENT_SECRET is not configured");
  }
  return createHmac("sha256", CLIENT_SECRET)
    .update(`${username}${CLIENT_ID}`)
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
  if (!CLIENT_ID) {
    throw new Error("NEXT_PUBLIC_COGNITO_CLIENT_ID is not configured");
  }

  const authParameters: Record<string, string> = {
    USERNAME: username,
    PASSWORD: password,
  };

  if (CLIENT_SECRET) {
    authParameters.SECRET_HASH = cognitoSecretHash(username);
  }

  try {
    const result = await client.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: CLIENT_ID,
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
  const authParameters: Record<string, string> = {
    REFRESH_TOKEN: refreshToken,
  };

  if (CLIENT_SECRET) {
    authParameters.SECRET_HASH = cognitoSecretHash(username);
  }

  const result = await client.send(
    new InitiateAuthCommand({
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: CLIENT_ID,
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
