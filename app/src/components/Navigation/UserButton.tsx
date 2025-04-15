import { useTheme } from "@emotion/react"
import AccountCircle from "mdi-react/AccountCircleIcon"
import { observer } from "mobx-react-lite"
import { FC, useRef, useState } from "react"
import { auth } from "../.././firebase/firebase"
import { isRunningInElectron } from "../../helpers/platform"
import { useStores } from "../../hooks/useStores"
import { Localized } from "../../localize/useLocalization"
import { Menu, MenuItem } from "../ui/Menu"
import { IconStyle, Tab, TabTitle } from "./Navigation"

export const UserButton: FC = observer(() => {
  const {
    rootViewStore,
    authStore: { authUser: user },
  } = useStores()

  const [open, setOpen] = useState(false)

  const onClickSignIn = () => {
    if (isRunningInElectron()) {
      window.electronAPI.openAuthWindow()
    } else {
      rootViewStore.openSignInDialog = true
    }
    setOpen(false)
  }


  if (user === null) {
    return (
      <Tab onClick={onClickSignIn}>
        <AccountCircle style={IconStyle} />
        <TabTitle>
          <Localized name="sign-in" />
        </TabTitle>
      </Tab>
    )
  }
})
