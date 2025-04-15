import { AuthUser, IUserRepository, User } from "@signal-app/api"
import { makeObservable, observable } from "mobx"
import { isRunningInElectron } from "../helpers/platform"

export class AuthStore {
  authUser: AuthUser | null = null
  user: User | null = null

  constructor(private readonly userRepository: IUserRepository) {
    makeObservable(this, {
      authUser: observable,
      user: observable,
    })

    let subscribe: (() => void) | null = null

    try {
      userRepository.observeAuthUser(async (user) => {
        this.authUser = user

        if (isRunningInElectron()) {
          window.electronAPI.authStateChanged(user !== null)
        }

        subscribe?.()

        if (user !== null) {
          subscribe = userRepository.observeCurrentUser((user) => {
            this.user = user
          })
        }
      })
    } catch (e) {
      console.warn(e)
    }
  }

  get isLoggedIn() {
    return this.authUser !== null
  }
}
