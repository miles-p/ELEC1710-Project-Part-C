#include "stm32f4xx.h"

extern void asm_main(void); // defined in sseg.s, never returns

int main(void)
{
    // Enable clocks for GPIOA, GPIOB, GPIOC (F4: GPIO on AHB1)
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN | RCC_AHB1ENR_GPIOBEN | RCC_AHB1ENR_GPIOCEN;

    // F4 GPIO: MODER has 2 bits per pin
    //   00 = input, 01 = output, 10 = alternate function, 11 = analog
    // PUPDR has 2 bits per pin: 00 = none, 01 = pull-up, 10 = pull-down
    // Masked writes only: PA13/PA14 are SWD and must stay as alternate function.

    // PC0-PC7: 7-segment outputs (push-pull)
    GPIOC->MODER = (GPIOC->MODER & ~0xFFFFu) | 0x5555u;

    // PA5: LED output
    GPIOA->MODER = (GPIOA->MODER & ~(0x3u << 10)) | (0x1u << 10);

    // PA8-PA11: tactile switches, inputs with internal pull-ups (pressed reads 0)
    GPIOA->MODER &= ~(0xFFu << 16);
    GPIOA->PUPDR = (GPIOA->PUPDR & ~(0xFFu << 16)) | (0x55u << 16);

    // PB13: button, floating input
    GPIOB->MODER &= ~(0x3u << 26);
    GPIOB->PUPDR &= ~(0x3u << 26);

    asm_main();

    while (1)
    {
    } // not reached
}
