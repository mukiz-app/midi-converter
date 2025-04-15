import { FC } from "react"
import { StyledFirebaseAuth } from "../../auth/StyledFirebaseAuth"
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "../Dialog/Dialog"

import styled from "@emotion/styled"
import "firebase/auth"
import { GoogleAuthProvider } from "firebase/auth"
import { auth } from "../.././firebase/firebase"
import { Localized } from "../../localize/useLocalization"
import { Button } from "../ui/Button"

const BetaLabel = styled.span`
  border: 1px solid currentColor;
  font-size: 0.8rem;
  padding: 0.1rem 0.4rem;
  margin-left: 1em;
  color: ${({ theme }) => theme.secondaryTextColor};
`

const Description = styled.div`
  margin: 1rem 0 2rem 0;
  line-height: 1.5;
`

export interface SignInDialogContentProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  onFailure: (error: firebaseui.auth.AuthUIError) => void
}

export const SignInDialogContent: FC<SignInDialogContentProps> = ({
  open,
  onClose,
  onSuccess,
  onFailure,
}) => {
  return (
    <Dialog open={open} onOpenChange={onClose} style={{ minWidth: "20rem" }}>
      <DialogTitle>
        <Localized name="sign-in" />
      </DialogTitle>
      <DialogContent>
        <StyledFirebaseAuth
          uiConfig={{
            signInOptions: [
              GoogleAuthProvider.PROVIDER_ID,
            ],
            callbacks: {
              signInSuccessWithAuthResult: (authResult, redirectUrl = "/") => {
                const user = authResult.user;
                // Check if the user exists
                checkIfUserExistOrDelete(user.uid)
                  .then(userExists => {
                    if (userExists.result === false) {
                      throw new Error('User not found');
                    }

                    // if user exists proceed to retrieve his data
                    return getUserData(user.uid);
                  })
                  .then(userData => {
                    const userRole = userData?.result?.role;
                    if (userRole) {
                      const allowedRoles = [2, 3];
                      if (allowedRoles.includes(userRole)) {
                        localStorage.setItem('Auth Result', JSON.stringify(authResult));
                        window.location.href = redirectUrl;
                        return true;
                      } else {
                        throw new Error('Unauthorized: Role unallowed');
                      }
                    } else {
                      throw new Error('Unauthorized: no role found');
                    }
                  })
                  .catch((err) => {
                    alert(`Access denied: ${err.message}`);
                    auth.signOut();
                    window.location.reload();
                    return false;
                  });

                return false;
              }
            },
            signInFlow: "popup",
          }}
          firebaseAuth={auth}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          <Localized name="close" />
        </Button>
      </DialogActions>
    </Dialog>
  )
}

async function checkIfUserExistOrDelete(userId: string) {
  const checkUserResponse = await fetch('https://us-central1-mukiz-231605.cloudfunctions.net/user-isExistOrDelete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: { userId: userId }
    })
  });
  return await checkUserResponse.json();
}

async function getUserData(userId: string) {
  const response = await fetch('https://us-central1-mukiz-231605.cloudfunctions.net/user-getUser', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      data: {
        userId: userId
      }
    })
  });
  if (!response.ok) {
    throw new Error(`Fetch failed with status: ${response.status}`);
  }
  return await response.json();
}
