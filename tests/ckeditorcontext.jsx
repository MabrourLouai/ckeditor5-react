/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import React from 'react';
import { configure, mount } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import CKEditorContext from '../src/ckeditorcontext.jsx';
import CKEditor from '../src/ckeditor.jsx';
import EditorMock from './_utils/editor.js';
import ContextWatchdog from '@ckeditor/ckeditor5-watchdog/src/contextwatchdog';
import CKEditorError from '@ckeditor/ckeditor5-utils/src/ckeditorerror';
import turnOffDefaultErrorCatching from './_utils-tests/turnoffdefaulterrorcatching.js';
import ContextMock from './_utils/context.js';

configure( { adapter: new Adapter() } );

describe( 'CKEditor Context Component', () => {
	let wrapper;

	afterEach( () => {
		sinon.restore();

		if ( wrapper ) {
			wrapper.unmount();
		}
	} );

	describe( 'initialization', () => {
		it( 'should create an instance of the ContextWatchdog', async () => {
			await new Promise( res => {
				wrapper = mount( <CKEditorContext context={ ContextMock } onReady={ res } /> );
			} );

			const component = wrapper.instance();

			expect( component.contextWatchdog ).to.be.an( 'object' );
			expect( component.contextWatchdog ).to.be.instanceOf( ContextWatchdog );
		} );

		it( 'should render its children', async () => {
			wrapper = mount(
				<CKEditorContext context={ ContextMock } >
					<div></div>
					<p>Foo</p>
				</CKEditorContext>
			);

			expect( wrapper.childAt( 0 ).name() ).to.equal( 'div' );
			expect( wrapper.childAt( 1 ).name() ).to.equal( 'p' );
		} );

		it( 'should render the inner editor component', async () => {
			const editorCreateSpy = sinon.spy( EditorMock, 'create' );

			await new Promise( ( res, rej ) => {
				wrapper = mount(
					<CKEditorContext context={ ContextMock } onError={ rej } >
						<CKEditor editor={ EditorMock } onReady={ res } onError={ rej } />
					</CKEditorContext>
				);
			} );

			const component = wrapper.instance();

			expect( component.contextWatchdog ).to.be.an( 'object' );
			expect( wrapper.childAt( 0 ).name() ).to.equal( 'CKEditor' );
			expect( wrapper.childAt( 0 ).prop( 'editor' ) ).to.be.a( 'function' );

			expect( wrapper.childAt( 0 ).instance().editor ).to.be.an( 'object' );

			sinon.assert.calledOnce( editorCreateSpy );

			expect( editorCreateSpy.firstCall.args[ 1 ] ).to.have.property( 'context' );
			expect( editorCreateSpy.firstCall.args[ 1 ].context ).to.be.instanceOf( ContextMock );
		} );

		it( 'should initialize its inner editors correctly', async () => {
			const editorCreateSpy = sinon.spy( EditorMock, 'create' );

			await new Promise( ( res, rej ) => {
				wrapper = mount(
					<CKEditorContext context={ ContextMock } onError={ rej } >
						<CKEditor editor={ EditorMock } config={ { initialData: '<p>Foo</p>' } } />
						<CKEditor editor={ EditorMock } config={ { initialData: '<p>Bar</p>' } } />
					</CKEditorContext>
				);

				const watchdog = wrapper.instance().contextWatchdog;

				watchdog.on( 'stateChange', () => {
					if ( watchdog.state === 'ready' ) {
						res();
					}
				} );
			} );

			const editor1 = wrapper.childAt( 0 ).instance().editor;
			const editor2 = wrapper.childAt( 1 ).instance().editor;

			expect( editor1 ).to.be.an( 'object' );
			expect( editor2 ).to.be.an( 'object' );

			sinon.assert.calledTwice( editorCreateSpy );

			expect( editorCreateSpy.firstCall.args[ 1 ].context ).to.be.instanceOf( ContextMock );
			expect( editorCreateSpy.secondCall.args[ 1 ].context ).to.be.instanceOf( ContextMock );
			expect( editorCreateSpy.firstCall.args[ 1 ].context ).to.equal( editorCreateSpy.secondCall.args[ 1 ].context );

			expect( editorCreateSpy.firstCall.args[ 1 ].initialData ).to.equal( '<p>Foo</p>' );
			expect( editorCreateSpy.secondCall.args[ 1 ].initialData ).to.equal( '<p>Bar</p>' );
		} );
	} );

	describe( 'properties', () => {
		describe( '#onError', () => {
			it( 'should be called when an initialization error occurs', async () => {
				const error = new Error();
				sinon.stub( ContextWatchdog.prototype, 'create' ).rejects( error );
				sinon.stub( ContextWatchdog.prototype, 'add' ).resolves();

				const errorEvent = await new Promise( res => {
					wrapper = mount(
						<CKEditorContext context={ ContextMock } onError={ ( error, details ) => res( { error, details } ) } >
							<CKEditor editor={ EditorMock } />
						</CKEditorContext>
					);
				} );

				expect( errorEvent ).to.be.an( 'object' );
				expect( errorEvent.error ).to.equal( error );
				expect( errorEvent.details ).to.deep.equal( {
					phase: 'initialization',
					willContextRestart: false
				} );
			} );

			it( 'should be called when a runtime error occurs', async () => {
				const onErrorSpy = sinon.spy();

				await new Promise( res => {
					wrapper = mount(
						<CKEditorContext
							context={ ContextMock }
							onReady={ res }
							onError={ onErrorSpy }
						>
							<CKEditor editor={ EditorMock } />
						</CKEditorContext >
					);
				} );

				const error = new CKEditorError( 'foo', wrapper.instance().contextWatchdog.context );

				await turnOffDefaultErrorCatching( () => {
					return new Promise( res => {
						wrapper.setProps( { onReady: res } );

						setTimeout( () => {
							throw error;
						} );
					} );
				} );

				sinon.assert.calledOnce( onErrorSpy );
				const errorEventArgs = onErrorSpy.firstCall.args;

				expect( errorEventArgs[ 0 ] ).to.equal( error );
				expect( errorEventArgs[ 1 ] ).to.deep.equal( {
					phase: 'runtime',
					willContextRestart: true
				} );
			} );
		} );

		describe( 'onReady', () => {
			it( 'should be called when all editors are ready', async () => {
				const editorReadySpy = sinon.spy();

				await new Promise( ( res, rej ) => {
					wrapper = mount(
						<CKEditorContext context={ ContextMock } onReady={ res } onError={ rej } >
							<CKEditor editor={ EditorMock } onReady={ editorReadySpy } config={ { initialData: '<p>Foo</p>' } } />
							<CKEditor editor={ EditorMock } onReady={ editorReadySpy } config={ { initialData: '<p>Bar</p>' } } />
						</CKEditorContext>
					);
				} );

				// A small hack - currently editors are ready one cycle after the context is ready.
				await new Promise( res => setTimeout( res ) );

				sinon.assert.calledTwice( editorReadySpy );
			} );
		} );
	} );

	describe( 'Restarting CKEditor Context with editor', () => {
		it( 'should restart the Context and all editors if the Context id changes', async () => {
			const oldContext = await new Promise( res => {
				wrapper = mount(
					<CKEditorContext context={ ContextMock } id="1" onReady={ res }>
						<CKEditor editor={ EditorMock } />
					</CKEditorContext>
				);
			} );

			const newContext = await new Promise( res => {
				wrapper.setProps( {
					id: '2',
					onReady: res
				} );
			} );

			expect( newContext ).to.not.equal( oldContext );
			expect( newContext ).to.be.an.instanceOf( ContextMock );
		} );
	} );
} );
