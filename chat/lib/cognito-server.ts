import { createHmac } from "crypto";
import {
  CodeMismatchException,
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  ExpiredCodeException,
  InitiateAuthCommand,
  InvalidPasswordException,
  NotAuthorizedException,
  ResendConfirmationCodeCommand,
  SignUpCommand,
  UsernameExistsException,
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

function requireClientId(): string {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error("NEXT_PUBLIC_COGNITO_CLIENT_ID is not configured");
  }
  return clientId;
}

function mapCognitoError(err: unknown): never {
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
  if (err instanceof UsernameExistsException) {
    throw Object.assign(new Error(err.message || "User already exists"), {
      code: "UsernameExistsException",
    });
  }
  if (err instanceof InvalidPasswordException) {
    throw Object.assign(new Error(err.message || "Invalid password"), {
      code: "InvalidPasswordException",
    });
  }
  if (err instanceof CodeMismatchException) {
    throw Object.assign(new Error(err.message || "Invalid verification code"), {
      code: "CodeMismatchException",
    });
  }
  if (err instanceof ExpiredCodeException) {
    throw Object.assign(new Error(err.message || "Verification code expired"), {
      code: "ExpiredCodeException",
    });
  }
  throw err;
}

export type AuthTokens = {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type SignUpResult = {
  userConfirmed: boolean;
  userSub: string;
};

export async function signUpWithPassword(
  username: string,
  password: string,
): Promise<SignUpResult> {
  const clientId = requireClientId();

  try {
    const result = await client.send(
      new SignUpCommand({
        ClientId: clientId,
        Username: username,
        Password: password,
        SecretHash: cognitoSecretHash(username),
        UserAttributes: [{ Name: "email", Value: username }],
      }),
    );

    return {
      userConfirmed: Boolean(result.UserConfirmed),
      userSub: result.UserSub ?? "",
    };
  } catch (err) {
    mapCognitoError(err);
  }
}

export async function confirmSignUpWithCode(
  username: string,
  confirmationCode: string,
): Promise<void> {
  const clientId = requireClientId();

  try {
    await client.send(
      new ConfirmSignUpCommand({
        ClientId: clientId,
        Username: username,
        ConfirmationCode: confirmationCode.trim(),
        SecretHash: cognitoSecretHash(username),
      }),
    );
  } catch (err) {
    mapCognitoError(err);
  }
}

export async function resendConfirmationCode(username: string): Promise<void> {
  const clientId = requireClientId();

  try {
    await client.send(
      new ResendConfirmationCodeCommand({
        ClientId: clientId,
        Username: username,
        SecretHash: cognitoSecretHash(username),
      }),
    );
  } catch (err) {
    mapCognitoError(err);
  }
}

export async function signInWithPassword(
  username: string,
  password: string,
): Promise<AuthTokens> {
  const clientId = requireClientId();

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
    mapCognitoError(err);
  }
}

export async function refreshTokens(
  refreshToken: string,
  username: string,
): Promise<AuthTokens> {
  const clientId = requireClientId();

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
