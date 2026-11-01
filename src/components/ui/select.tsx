import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { cn } from '@/lib/utils'

type SelectProps = Pick<React.ComponentProps<'select'>, 'children' | 'name' | 'disabled' | 'id' | 'className' | 'aria-label' | 'aria-labelledby' | 'aria-describedby'> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

// Radix reserves an empty value for its placeholder; our forms also offer an
// explicit "none/all" choice. Keep that implementation detail out of FormData.
const emptyValue = '__pixel_select_empty__'
const encode = (value: string) => value || emptyValue

export function Select({ children, name, disabled, value, defaultValue, onValueChange, className, ...props }: SelectProps) {
  const options = React.Children.toArray(children).filter(React.isValidElement<React.ComponentProps<'option'>>).map(option => ({
    value: String(option.props.value ?? option.props.children),
    label: option.props.children,
    disabled: option.props.disabled,
  }))
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? options[0]?.value ?? '')
  const [container, setContainer] = React.useState<HTMLElement | null>(null)
  const attachTrigger = React.useCallback((node: HTMLButtonElement | null) => {
    setContainer(node?.closest<HTMLElement>('.site') ?? null)
  }, [])
  const selected = value ?? internalValue

  return <>
    {name && <input type="hidden" name={name} value={selected} disabled={disabled} />}
    <SelectPrimitive.Root value={encode(selected)} disabled={disabled} onValueChange={next => {
      const decoded = next === emptyValue ? '' : next
      setInternalValue(decoded)
      onValueChange?.(decoded)
    }}>
      <SelectPrimitive.Trigger {...props} ref={attachTrigger} className={cn('pixel-select-trigger', className)}>
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon asChild><span className="pixel-select-arrow" /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal container={container}>
        <SelectPrimitive.Content className="pixel-select-menu" position="popper" sideOffset={4} collisionPadding={12}>
          <SelectPrimitive.ScrollUpButton className="pixel-select-scroll" aria-label="Scroll options up">▲</SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="pixel-select-options">
            {options.map(option => <SelectPrimitive.Item key={option.value} value={encode(option.value)} disabled={option.disabled} className="pixel-select-option">
              <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              <SelectPrimitive.ItemIndicator className="pixel-select-indicator">◆</SelectPrimitive.ItemIndicator>
            </SelectPrimitive.Item>)}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="pixel-select-scroll" aria-label="Scroll options down">▼</SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  </>
}
