import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import Modal from "./Modal";
import { submitIssueReport } from "../../services/diagnosticService";
import { useToast } from "../../context/ToastContext";

/*
 * The user's side of a diagnosis: the machine already knows what failed, so
 * this form only asks for what the machine cannot know — what they were trying
 * to do. The diagnosis is attached automatically.
 */

const IssueReportDialog = ({ open, diagnosis, onClose, defaultFeature }) => {
  const [note, setNote] = useState("");
  const [steps, setSteps] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState(null);
  const toast = useToast();

  const submit = async () => {
    if (note.trim().length < 3) {
      setFailure("Please add one line about what you were doing.");
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const result = await submitIssueReport({
        note: note.trim(),
        feature: defaultFeature || diagnosis?.feature,
        diagnosis,
        steps: steps
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      });
      setDone(true);
      toast.success(result?.data?.message || "Thanks — the team can see this report.");
    } catch (error) {
      // Reporting an error must not fail silently: if the report cannot be
      // sent, say so and leave the text on screen to copy out.
      setFailure(
        error?.response
          ? "We could not send this report. Your text is still here — please try again."
          : "You appear to be offline, so this report could not be sent. Your text is still here."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={done ? "Report received" : "Report a problem"}
      onClose={onClose}
      footer={
        done ? (
          <button className="btn btn-primary btn-sm" onClick={onClose}>
            Close
          </button>
        ) : (
          <>
            <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>
              <Send size={14} /> {busy ? "Sending..." : "Send report"}
            </button>
          </>
        )
      }
    >
      {done ? (
        <div className="report-done">
          <CheckCircle2 size={28} />
          <p>
            The error details below went with your report
            {diagnosis?.errorRef ? (
              <>
                {" "}against reference <code>{diagnosis.errorRef}</code>
              </>
            ) : null}
            .
          </p>
        </div>
      ) : (
        <>
          <p className="modal-intro">
            Tell us what you were trying to do. The technical summary is attached for you.
          </p>

          {diagnosis && (
            <div className="report-attached">
              <div>
                <span>{diagnosis.what}</span>
                <small>
                  {diagnosis.featureLabel} · {diagnosis.categoryLabel}
                  {diagnosis.errorRef ? ` · ref ${diagnosis.errorRef}` : ""}
                </small>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="issue-note">
              What went wrong for you
            </label>
            <textarea
              id="issue-note"
              className="textarea"
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="For example: I recorded a complaint by voice and it never turned into text."
              maxLength={2000}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="issue-steps">
              Steps to repeat it (optional, one per line)
            </label>
            <textarea
              id="issue-steps"
              className="textarea"
              rows={3}
              value={steps}
              onChange={(event) => setSteps(event.target.value)}
              placeholder={"Open the report form\nTap the microphone\nSpeak for a few seconds"}
            />
          </div>

          {failure && <p className="report-failure">{failure}</p>}
        </>
      )}
    </Modal>
  );
};

export default IssueReportDialog;
