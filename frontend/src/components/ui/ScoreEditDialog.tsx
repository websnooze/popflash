import { useEffect, useState } from "react";
import { AlertDialog, Button, Input, Label, TextField } from "@heroui/react";

type ScoreEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team1Name: string;
  team2Name: string;
  score1: number;
  score2: number;
  isPending?: boolean;
  onSave: (score1: number, score2: number) => void;
};

export function ScoreEditDialog({
  open,
  onOpenChange,
  team1Name,
  team2Name,
  score1,
  score2,
  isPending = false,
  onSave,
}: ScoreEditDialogProps) {
  const [s1, setS1] = useState(String(score1));
  const [s2, setS2] = useState(String(score2));

  useEffect(() => {
    if (open) {
      setS1(String(score1));
      setS2(String(score2));
    }
  }, [open, score1, score2]);

  return (
    <AlertDialog isOpen={open} onOpenChange={onOpenChange}>
      <AlertDialog.Backdrop variant="blur" isDismissable isKeyboardDismissDisabled={false}>
        <AlertDialog.Container placement="center">
          <AlertDialog.Dialog className="outline-none">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="accent" />
              <AlertDialog.Heading>Score du match</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField>
                  <Label>{team1Name || "Équipe 1"}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={s1}
                    onChange={(e) => setS1(e.target.value)}
                  />
                </TextField>
                <TextField>
                  <Label>{team2Name || "Équipe 2"}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={s2}
                    onChange={(e) => setS2(e.target.value)}
                  />
                </TextField>
              </div>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="ghost" isDisabled={isPending} onPress={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button
                variant="primary"
                isPending={isPending}
                onPress={() => {
                  onSave(Number(s1) || 0, Number(s2) || 0);
                  onOpenChange(false);
                }}
              >
                Enregistrer
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
