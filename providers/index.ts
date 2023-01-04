import type { ApplicationContract } from '@ioc:Adonis/Core/Application'

export default class MicrosoftProvider {
  constructor(protected app: ApplicationContract) {}

  public async boot() {
    const Ally = this.app.container.resolveBinding('Adonis/Addons/Ally')
    const { Microsoft } = await import('../src/Microsoft')

    Ally.extend('Microsoft', (_, __, config, ctx) => {
      return new Microsoft(ctx, config)
    })
  }
}
