'use client'

import * as React from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { useControlledState } from '@/lib/use-controlled-state'
import { getStrictContext } from '@/lib/get-strict-context'

type AlertDialogContextType = {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const [AlertDialogProvider, useAlertDialog] =
  getStrictContext<AlertDialogContextType>('AlertDialogContext')

type AlertDialogProps = React.ComponentProps<typeof AlertDialogPrimitive.Root>

function AlertDialog(props: AlertDialogProps) {
  const [isOpen, setIsOpen] = useControlledState({
    value: props?.open,
    defaultValue: props?.defaultOpen,
    onChange: props?.onOpenChange,
  })

  return (
    <AlertDialogProvider value={{ isOpen: isOpen ?? false, setIsOpen }}>
      <AlertDialogPrimitive.Root
        data-slot="alert-dialog"
        {...props}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </AlertDialogProvider>
  )
}

type AlertDialogTriggerProps = React.ComponentProps<
  typeof AlertDialogPrimitive.Trigger
>

function AlertDialogTrigger(props: AlertDialogTriggerProps) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

type AlertDialogPortalProps = React.ComponentProps<
  typeof AlertDialogPrimitive.Portal
>

function AlertDialogPortal(props: AlertDialogPortalProps) {
  const { isOpen } = useAlertDialog()

  return (
    <AnimatePresence>
      {isOpen && (
        <AlertDialogPrimitive.Portal
          data-slot="alert-dialog-portal"
          forceMount
          {...props}
        />
      )}
    </AnimatePresence>
  )
}

type AlertDialogBackdropProps = Omit<
  React.ComponentProps<'div'>,
  'children'
> & {
  transition?: {
    duration?: number
    ease?: string | number[]
  }
}

function AlertDialogBackdrop({
  className,
  transition = { duration: 0.2, ease: 'easeInOut' },
  ...props
}: AlertDialogBackdropProps) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-backdrop"
      forceMount
      {...props}
      className={cn('fixed inset-0 z-50', className)}
    >
      <motion.div
        initial={{ opacity: 0, filter: 'blur(4px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, filter: 'blur(4px)' }}
        transition={transition as any}
        className="fixed inset-0 z-50 bg-black/50"
      />
    </AlertDialogPrimitive.Overlay>
  )
}

type AlertDialogFlipDirection = 'top' | 'bottom' | 'left' | 'right'

type AlertDialogPopupProps = Omit<
  React.ComponentProps<typeof AlertDialogPrimitive.Content>,
  'asChild' | 'children'
> & {
  from?: AlertDialogFlipDirection
  transition?: {
    type?: string
    stiffness?: number
    damping?: number
    duration?: number
  }
  children?: React.ReactNode
}

function AlertDialogPopup({
  from = 'top',
  className,
  transition = { type: 'spring', stiffness: 150, damping: 25 },
  children,
  ...props
}: AlertDialogPopupProps) {
  const initialRotation =
    from === 'bottom' || from === 'left' ? '20deg' : '-20deg'
  const isVertical = from === 'top' || from === 'bottom'
  const rotateAxis = isVertical ? 'rotateX' : 'rotateY'

  return (
    <AlertDialogPrimitive.Content
      data-slot="alert-dialog-popup"
      forceMount
      {...props}
      className={cn(
        'fixed top-[50%] left-[50%] z-50 w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%]',
        className
      )}
    >
      <motion.div
        initial={{
          opacity: 0,
          filter: 'blur(4px)',
          transform: `perspective(500px) ${rotateAxis}(${initialRotation}) scale(0.8)`,
        }}
        animate={{
          opacity: 1,
          filter: 'blur(0px)',
          transform: `perspective(500px) ${rotateAxis}(0deg) scale(1)`,
        }}
        exit={{
          opacity: 0,
          filter: 'blur(4px)',
          transform: `perspective(500px) ${rotateAxis}(${initialRotation}) scale(0.8)`,
        }}
        transition={transition as any}
        className="grid gap-4 rounded-lg border bg-background p-6 shadow-lg w-full"
      >
        {children}
      </motion.div>
    </AlertDialogPrimitive.Content>
  )
}

type AlertDialogContentProps = AlertDialogPopupProps & {
  showBackdrop?: boolean
  children?: React.ReactNode
}

function AlertDialogContent({
  showBackdrop = true,
  children,
  ...props
}: AlertDialogContentProps) {
  return (
    <AlertDialogPortal>
      {showBackdrop && <AlertDialogBackdrop />}
      <AlertDialogPopup {...props}>{children}</AlertDialogPopup>
    </AlertDialogPortal>
  )
}

type AlertDialogCloseProps = React.ComponentProps<
  typeof AlertDialogPrimitive.Cancel
>

function AlertDialogClose(props: AlertDialogCloseProps) {
  return (
    <AlertDialogPrimitive.Cancel data-slot="alert-dialog-close" {...props} />
  )
}

type AlertDialogHeaderProps = React.ComponentProps<'div'>

function AlertDialogHeader({ className, ...props }: AlertDialogHeaderProps) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

type AlertDialogFooterProps = React.ComponentProps<'div'>

function AlertDialogFooter({ className, ...props }: AlertDialogFooterProps) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className
      )}
      {...props}
    />
  )
}

type AlertDialogTitleProps = React.ComponentProps<
  typeof AlertDialogPrimitive.Title
>

function AlertDialogTitle({ className, ...props }: AlertDialogTitleProps) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn('text-lg font-semibold', className)}
      {...props}
    />
  )
}

type AlertDialogDescriptionProps = React.ComponentProps<
  typeof AlertDialogPrimitive.Description
>

function AlertDialogDescription({
  className,
  ...props
}: AlertDialogDescriptionProps) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

type AlertDialogActionProps = React.ComponentProps<
  typeof AlertDialogPrimitive.Action
> & {
  onClick?: () => void
}

function AlertDialogAction({
  className,
  onClick,
  ...props
}: AlertDialogActionProps) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(buttonVariants(), className)}
      onClick={onClick}
      {...props}
    />
  )
}

type AlertDialogCancelProps = React.ComponentProps<
  typeof AlertDialogPrimitive.Cancel
> & {
  onClick?: () => void
}

function AlertDialogCancel({
  className,
  onClick,
  ...props
}: AlertDialogCancelProps) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: 'outline' }), className)}
      onClick={onClick}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogPopup,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  useAlertDialog,
  type AlertDialogProps,
  type AlertDialogTriggerProps,
  type AlertDialogPortalProps,
  type AlertDialogCloseProps,
  type AlertDialogBackdropProps,
  type AlertDialogPopupProps,
  type AlertDialogContentProps,
  type AlertDialogHeaderProps,
  type AlertDialogFooterProps,
  type AlertDialogTitleProps,
  type AlertDialogDescriptionProps,
  type AlertDialogActionProps,
  type AlertDialogCancelProps,
  type AlertDialogContextType,
  type AlertDialogFlipDirection,
}
