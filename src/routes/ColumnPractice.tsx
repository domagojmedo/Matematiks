import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ColumnQuestion } from "../components/questions/ColumnQuestion";
import { summarizeSetup } from "../lib/format";
import { OPERATION_SYMBOL, OPERATION_TONE } from "../lib/operations";
import { generateProblem, type Problem } from "../lib/problemGen";
import type { Operation, OperationSetup } from "../lib/types";
import { RoundHost } from "./RoundHost";

export function ColumnPractice({
  op,
  setup,
  lessonId,
}: {
  op: Operation;
  setup: OperationSetup;
  lessonId?: string;
}) {
  const { t } = useTranslation();
  const guide = setup.guide ?? true;
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
        <ColumnQuestion problem={problem} guide={guide} api={api} />
      )}
    />
  );
}
