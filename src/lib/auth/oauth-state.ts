export const GOOGLE_STATE_COOKIE = "ownreach_oauth_state";

export interface OAuthStateCookie {
  state: string;
  mode: "signin" | "link";
}
