import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { HorizontalQuestion } from "../components/questions/HorizontalQuestion";
import { useProfiles } from "../contexts/ProfilesContext";
import { summarizeSetup } from "../lib/format";
import {
  isValidOperation,
  OPERATION_SYMBOL,
  OPERATION_TONE,
} from "../lib/operations";
import { generateProblem, type Problem } from "../lib/problemGen";
import { getSetup, withTablePartners } from "../lib/setup";
import { PROFILE_KEYS, profileKey, writeJSON } from "../lib/storage";
import type { LastSession, Operation, OperationSetup } from "../lib/types";
import { ColumnPractice } from "./ColumnPractice";
import { RoundHost } from "./RoundHost";

export function Practice() {
  const { operation } = useParams<{ operation: string }>();
  const isValidOp = operation !== undefined && isValidOperation(operation);
  const op: Operation = isValidOp ? operation : "add";
  const { profileId } = useProfiles();
  const location = useLocation();

  const [{ setup, lessonId }] = useState<{
    setup: OperationSetup;
    lessonId?: string;
  }>(() => {
    const state = location.state as {
      setup?: OperationSetup;
      lessonId?: string;
    } | null;
    // Custom rounds (Quick Start, "repeat round") carry a setup but no lessonId;
    // theirs may predate the table-partner rule, so normalize it. Lesson setups
    // are authored and must pass through untouched.
    const raw = state?.setup ?? getSetup(profileId, op);
    return {
      setup: state?.lessonId ? raw : withTablePartners(raw),
      lessonId: state?.lessonId,
    };
  });

  useEffect(() => {
    const state = location.state as {
      setup?: OperationSetup;
      lessonId?: string;
    } | null;
    if (!state?.setup) return;
    const last: LastSession = {
      operation: op,
      setup: state.setup,
      ...(state.lessonId ? { lessonId: state.lessonId } : {}),
    };
    writeJSON(profileKey(profileId, PROFILE_KEYS.lastSession), last);
  }, [location.state, op, profileId]);

  if (!isValidOp) {
    return <Navigate to="/" replace />;
  }

  if (setup.format === "column") {
    return <ColumnPractice op={op} setup={setup} lessonId={lessonId} />;
  }
  return <HorizontalPractice op={op} setup={setup} lessonId={lessonId} />;
}

function HorizontalPractice({
  op,
  setup,
  lessonId,
}: {
  op: Operation;
  setup: OperationSetup;
  lessonId?: string;
}) {
  const { t } = useTranslation();
  const generate = useCallback(
    (prev: Problem | null) => generateProblem(op, setup, prev),
    [op, setup],
  );
  return (
    <RoundHost<Problem>
      op={op}
      setup={setup}
      lessonId={lessonId}
      chip={{
        tone: OPERATION_TONE[op],
        symbol: OPERATION_SYMBOL[op],
        label: t(`operations.${op}`),
        summary: summarizeSetup(setup),
      }}
      generate={generate}
      renderQuestion={(problem, api) => (
        <HorizontalQuestion problem={problem} api={api} />
      )}
    />
  );
}
