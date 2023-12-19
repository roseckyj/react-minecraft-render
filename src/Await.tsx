import * as React from 'react';

interface IAwaitProps<T> {
    for: Promise<T>;
    loading?: JSX.Element;
    error?: (error: any) => JSX.Element;
    children: ((data: T) => JSX.Element) | JSX.Element;
}

export function Await<T>(props: IAwaitProps<T>) {
    const [state, setState] = React.useState<'pending' | 'fulfilled' | 'rejected'>('pending');
    const [data, setData] = React.useState<T | null>(null);
    const [error, setError] = React.useState<any | null>(null);

    const resolver = async () => {
        try {
            const data = await props.for;
            setData(data);
            setState('fulfilled');
        } catch (error: any) {
            setError(error);
            setState('rejected');
        }
    };

    if (state === 'pending') resolver();

    switch (state) {
        case 'pending':
            return props.loading || <></>;
        case 'fulfilled':
            if (typeof props.children === 'function') {
                return (props.children as (data: T) => JSX.Element)(data!);
            }
            return props.children;
        case 'rejected':
            // console.warn(error);
            if (props.error) return props.error(error);
            return <></>;
    }
}
