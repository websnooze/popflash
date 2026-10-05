import { Description, Label, ListBox, Select, Switch } from "@heroui/react";
import type { SelectOption } from "@/lib/lobby-options";

export function FieldSelect({
  label,
  value,
  options,
  isDisabled,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  isDisabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      className="w-full"
      fullWidth
      isDisabled={isDisabled}
      value={value}
      onChange={(key) => {
        if (key == null) return;
        onChange(String(key));
      }}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export function FieldSwitch({
  label,
  description,
  isSelected,
  isDisabled,
  onChange,
}: {
  label: string;
  description?: string;
  isSelected: boolean;
  isDisabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Switch isSelected={isSelected} isDisabled={isDisabled} onChange={onChange}>
      <Switch.Content>
        <div className="flex flex-col gap-0.5">
          <Label>{label}</Label>
          {description ? <Description>{description}</Description> : null}
        </div>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Content>
    </Switch>
  );
}

export function FieldSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  isDisabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  isDisabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-center justify-between text-sm font-medium">
        <span>{label}</span>
        <span className="tabular-nums text-pf-muted">
          {unit === "$" ? `$${value}` : unit ? `${value} ${unit}` : value}
        </span>
      </span>
      <input
        type="range"
        className="pf-range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={isDisabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
