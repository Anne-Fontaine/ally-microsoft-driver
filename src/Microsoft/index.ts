/*
|--------------------------------------------------------------------------
| Ally Oauth driver
|--------------------------------------------------------------------------
|
| This is a dummy implementation of the Oauth driver. Make sure you
|
| - Got through every line of code
| - Read every comment
|
*/

import { ApiRequest, Oauth2Driver, RedirectRequest } from '@adonisjs/ally/build/standalone'
import type {
  AllyUserContract,
  ApiRequestContract,
  LiteralStringUnion,
} from '@ioc:Adonis/Addons/Ally'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

/**
 * Define the access token object properties in this type. It
 * must have "token" and "type" and you are free to add
 * more properties.
 *
 * ------------------------------------------------
 * Change "Microsoft" to something more relevant
 * ------------------------------------------------
 */
export type MicrosoftAccessToken = {
  token: string
  type: 'bearer'
}

/**
 * Define a union of scopes your driver accepts. Here's an example of same
 * https://github.com/adonisjs/ally/blob/develop/adonis-typings/ally.ts#L236-L268
 *
 * ------------------------------------------------
 * Change "Microsoft" to something more relevant
 * ------------------------------------------------
 */
export type MicrosoftScopes = string

/**
 * Define the configuration options accepted by your driver. It must have the following
 * properties and you are free add more.
 *
 * ------------------------------------------------
 * Change "Microsoft" to something more relevant
 * ------------------------------------------------
 */
export type MicrosoftConfig = {
  driver: 'Microsoft'
  clientId: string
  clientSecret: string
  tenantId: string
  callbackUrl: string
  authorizeUrl?: string
  accessTokenUrl?: string
  userInfoUrl?: string
  scopes?: LiteralStringUnion<MicrosoftScopes>[]
}

/**
 * Driver implementation. It is mostly configuration driven except the user calls
 *
 * ------------------------------------------------
 * Change "Microsoft" to something more relevant
 * ------------------------------------------------
 */
export class Microsoft extends Oauth2Driver<MicrosoftAccessToken, MicrosoftScopes> {
  /**
   * The URL for the redirect request. The user will be redirected on this page
   * to authorize the request.
   *
   * Do not define query strings in this URL.
   */
  protected authorizeUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/authorize`

  /**
   * The URL to hit to exchange the authorization code for the access token
   *
   * Do not define query strings in this URL.
   */
  protected accessTokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`

  /**
   * The URL to hit to get the user details
   *
   * Do not define query strings in this URL.
   */
  protected userInfoUrl = 'https://graph.microsoft.com/v1.0/me'

  /**
   * The param name for the authorization code. Read the documentation of your oauth
   * provider and update the param name to match the query string field name in
   * which the oauth provider sends the authorization_code post redirect.
   */
  protected codeParamName = 'code'

  /**
   * The param name for the error. Read the documentation of your oauth provider and update
   * the param name to match the query string field name in which the oauth provider sends
   * the error post redirect
   */
  protected errorParamName = 'error_description'

  /**
   * Cookie name for storing the CSRF token. Make sure it is always unique. So a better
   * approach is to prefix the oauth provider name to `oauth_state` value. For example:
   * For example: "facebook_oauth_state"
   */
  protected stateCookieName = 'microsoft_oauth_state'

  /**
   * Parameter name to be used for sending and receiving the state from.
   * Read the documentation of your oauth provider and update the param
   * name to match the query string used by the provider for exchanging
   * the state.
   */
  protected stateParamName = 'state'

  /**
   * Parameter name for sending the scopes to the oauth provider.
   */
  protected scopeParamName = 'scope'

  /**
   * The separator indentifier for defining multiple scopes
   */
  protected scopesSeparator = ' '

  constructor(ctx: HttpContextContract, public config: MicrosoftConfig) {
    super(ctx, config)

    config.scopes = config.scopes || ['openid', 'profile', 'email', 'offline_access']

    /**
     * Extremely important to call the following method to clear the
     * state set by the redirect request.
     *
     * DO NOT REMOVE THE FOLLOWING LINE
     */
    this.loadState()
    this.stateless()
  }

  protected configureRedirectRequest(request: RedirectRequest<MicrosoftScopes>): void {
    /**
     * Define user defined scopes or the default one's
     */
    request.scopes(this.config.scopes || ['openid', 'profile', 'email', 'offline_access'])

    request.param('client_id', this.config.clientId)
    request.param('response_type', 'code')
    request.param('response_mode', 'query')
  }

  public accessDenied() {
    return this.ctx.request.input('error') === 'invalid_grant'
  }

  protected getAuthenticatedRequest(url: string, token: string): ApiRequest {
    const request = this.httpClient(url)
    request.header('Authorization', `Bearer ${token}`)
    request.header('Accept', 'application/json')
    request.parseAs('json')
    return request
  }

  protected async getUserInfo(
    token: string,
    callback?: (request: ApiRequestContract) => void
  ): Promise<UserFields> {
    // User Info
    const userRequest = this.getAuthenticatedRequest(
      this.config.userInfoUrl || this.userInfoUrl,
      token
    )
    if (typeof callback === 'function') {
      callback(userRequest)
    }

    const userBody: UserInfo = await userRequest.get()

    return {
      id: userBody.id,
      nickName: userBody.id,
      displayName: userBody.displayName,
      avatarUrl: null,
      name: `${userBody.givenName}${userBody.surname ? ` ${userBody.surname}` : ''}`,
      email: userBody.mail ? (userBody.mail as string) : (null as null),
      emailVerificationState: 'unsupported' as const,
      original: userBody,
    }
  }

  protected processClientResponse(client: ApiRequest, response: any): any {
    /**
     * Return json as it is when parsed response as json
     */
    if (client.responseType === 'json') {
      return response
    }

    // return parse(client.responseType === 'buffer' ? response.toString() : response)
  }

  public async user(
    callback?: (request: ApiRequest) => void
  ): Promise<AllyUserContract<MicrosoftAccessToken>> {
    const accessToken = await this.accessToken(callback)

    /**
     * Allow end user to configure the request. This should be called after your custom
     * configuration, so that the user can override them (if required)
     */
    const user: UserFields = await this.getUserInfo(accessToken.token, callback)

    /**
     * Write your implementation details here
     */
    return {
      ...user,
      token: accessToken,
    }
  }

  public async userFromToken(token: string): Promise<UserFieldsAndToken> {
    const user: UserFields = await this.getUserInfo(token)

    return {
      ...user,
      token: { token, type: 'bearer' as const },
    }
  }
}

export type UserInfo = {
  '@odata.context': string
  '@odata.id': string
  'businessPhones': string[]
  'displayName': string
  'givenName': string
  'jobTitle': string
  'mail': string
  'mobilePhone': string
  'officeLocation': string
  'preferredLanguage'?: any
  'surname': string
  'userPrincipalName': string
  'id': string
}

export type UserFields = {
  id: string
  avatarUrl: string | null
  nickName: string
  displayName?: string | undefined
  name: string
  email: string | null
  emailVerificationState: 'verified' | 'unverified' | 'unsupported'
  original: UserInfo | null
}

export interface UserFieldsAndToken extends UserFields {
  token: {
    token: string
    type: 'bearer'
  }
}
